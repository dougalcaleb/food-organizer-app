import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as planRepo from '@/db/repositories/plan'
import * as pullsRepo from '@/db/repositories/pulls'
import { itemKey } from '@/lib/shoppingList'
import type { Meal, MealPull } from '@/types'
import { useMealsStore } from './meals'

export const usePlanStore = defineStore('plan', () => {
	const mealIds = ref<string[]>([])

	/*
	Which of each planned meal's ingredients are currently on the shopping list.

	This lives here rather than in the list store for two reasons. It is
	per-planned-meal state with exactly the plan entry's lifetime — a meal
	leaving the plan takes its pull with it — and putting it here keeps the
	dependency between the two stores pointing one way, since the list store
	already reads the plan and the reverse import would close a cycle.
	*/
	const pulls = ref<MealPull[]>([])

	const isPlanned = computed(() => (id: string) => mealIds.value.includes(id))

	/** Planned meals, resolved and in plan order. Skips anything since deleted. */
	const plannedMeals = computed(() => {
		const meals = useMealsStore()
		return mealIds.value.flatMap((id) => {
			const meal = meals.get(id)
			return meal ? [meal] : []
		})
	})

	const pullsByMeal = computed(() => new Map(pulls.value.map((p) => [p.mealId, p])))

	/**
	 * The normalized names this meal currently has on the list. Empty for a meal
	 * nothing has been pulled from.
	 */
	function pulledNames(mealId: string): string[] {
		return pullsByMeal.value.get(mealId)?.names ?? []
	}

	function isPulled(mealId: string, name: string): boolean {
		return pulledNames(mealId).includes(itemKey(name))
	}

	async function hydrate() {
		const [ids, stored] = await Promise.all([planRepo.planIds(), pullsRepo.allPulls()])
		mealIds.value = ids
		pulls.value = stored
	}

	async function add(id: string) {
		if (mealIds.value.includes(id)) return
		mealIds.value.push(id)
		await planRepo.addToPlan(id)
	}

	/**
	 * A meal leaving the plan takes its pull with it, however it leaves.
	 *
	 * Leaving the record behind would be invisible right up until the meal was
	 * planned again, at which point ingredients nobody asked for would reappear
	 * on the list — and, worse, appear already bought if their keys were still
	 * checked. `clearOrphanedChecked` on the list store is the other half.
	 */
	async function remove(id: string) {
		mealIds.value = mealIds.value.filter((m) => m !== id)
		await Promise.all([planRepo.removeFromPlan(id), dropPull(id)])
	}

	/**
	 * "Made it" — the only action that records history. Drops the meal from the
	 * plan AND stamps last-made, which is what feeds the "been a while" ranking.
	 * Plain removal deliberately does neither.
	 */
	async function markMade(id: string) {
		await Promise.all([remove(id), useMealsStore().markMade(id)])
	}

	/* ── Pulling ingredients onto the shopping list ───────────────────────── */

	/** Write one meal's pulled set, deleting the record when it empties out. */
	async function setPulled(mealId: string, names: readonly string[]) {
		const unique = [...new Set(names.map(itemKey))]

		if (!unique.length) {
			await dropPull(mealId)
			return
		}

		const existing = pullsByMeal.value.get(mealId)
		const pull: MealPull = {
			mealId,
			names: unique,
			// The stamp is when the meal first reached the list, not when it was
			// last edited: unticking one ingredient is not a new trip's worth of
			// shopping.
			pulledAt: existing?.pulledAt ?? Date.now(),
		}

		pulls.value = [...pulls.value.filter((p) => p.mealId !== mealId), pull]
		await pullsRepo.putPull(pull)
	}

	async function dropPull(mealId: string) {
		if (!pullsByMeal.value.has(mealId)) return

		pulls.value = pulls.value.filter((p) => p.mealId !== mealId)
		await pullsRepo.deletePull(mealId)
	}

	/** Put every one of a meal's ingredients on the list. */
	async function pullAll(meal: Meal) {
		await setPulled(
			meal.id,
			meal.ingredients.map((i) => i.name),
		)
	}

	/** Add or remove one ingredient of one meal. */
	async function togglePulled(mealId: string, name: string) {
		const key = itemKey(name)
		const current = pulledNames(mealId)

		await setPulled(
			mealId,
			current.includes(key) ? current.filter((n) => n !== key) : [...current, key],
		)
	}

	/**
	 * Remove the given normalized names from every meal that has them on the
	 * list, in one write. This is what finishing a shopping trip does: the
	 * ingredient has been bought, and the meal must not ask for it again while
	 * it stays planned.
	 */
	async function releasePulled(names: readonly string[]) {
		const drop = new Set(names)
		if (!drop.size) return

		const kept: MealPull[] = []
		const written: MealPull[] = []
		const deleted: string[] = []

		for (const pull of pulls.value) {
			const remaining = pull.names.filter((n) => !drop.has(n))

			if (remaining.length === pull.names.length) {
				kept.push(pull)
				continue
			}

			if (!remaining.length) {
				deleted.push(pull.mealId)
				continue
			}

			const updated = { ...pull, names: remaining }
			kept.push(updated)
			written.push(updated)
		}

		if (!written.length && !deleted.length) return

		pulls.value = kept
		await pullsRepo.writePulls(written, deleted)
	}

	return {
		mealIds,
		pulls,
		isPlanned,
		plannedMeals,
		pulledNames,
		isPulled,
		hydrate,
		add,
		remove,
		markMade,
		setPulled,
		dropPull,
		pullAll,
		togglePulled,
		releasePulled,
	}
})
