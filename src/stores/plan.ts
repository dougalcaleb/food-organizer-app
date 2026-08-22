import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as planRepo from '@/db/repositories/plan'
import { useMealsStore } from './meals'

export const usePlanStore = defineStore('plan', () => {
	const mealIds = ref<string[]>([])

	const isPlanned = computed(() => (id: string) => mealIds.value.includes(id))

	/** Planned meals, resolved and in plan order. Skips anything since deleted. */
	const plannedMeals = computed(() => {
		const meals = useMealsStore()
		return mealIds.value.flatMap((id) => {
			const meal = meals.get(id)
			return meal ? [meal] : []
		})
	})

	async function hydrate() {
		mealIds.value = await planRepo.planIds()
	}

	async function add(id: string) {
		if (mealIds.value.includes(id)) return
		mealIds.value.push(id)
		await planRepo.addToPlan(id)
	}

	async function remove(id: string) {
		mealIds.value = mealIds.value.filter((m) => m !== id)
		await planRepo.removeFromPlan(id)
	}

	/**
	 * "Made it" — the only action that records history. Drops the meal from the
	 * plan AND stamps last-made, which is what feeds the "been a while" ranking.
	 * Plain removal deliberately does neither.
	 */
	async function markMade(id: string) {
		await Promise.all([remove(id), useMealsStore().markMade(id)])
	}

	return { mealIds, isPlanned, plannedMeals, hydrate, add, remove, markMade }
})
