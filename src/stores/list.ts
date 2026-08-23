import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as checkedRepo from '@/db/repositories/checked'
import * as extrasRepo from '@/db/repositories/extras'
import { buildItems, extraKey, groupItems } from '@/lib/shoppingList'
import type { ExtraItem, ExtraKind, ShopView, Store } from '@/types'
import { useMealsStore } from './meals'
import { usePlanStore } from './plan'
import { useSettingsStore } from './settings'

export const useListStore = defineStore('list', () => {
	const extras = ref<ExtraItem[]>([])
	const checked = ref(new Set<string>())
	/** null until the user picks a view; falls back to the configured default. */
	const viewOverride = ref<ShopView | null>(null)

	const view = computed({
		get: () => viewOverride.value ?? useSettingsStore().settings.defaultShopView,
		set: (v: ShopView) => {
			viewOverride.value = v
		},
	})

	/*
	The shopping list is derived on every read — never stored. Everything below
	falls out of (meals, plan, extras).
	*/
	const items = computed(() =>
		buildItems(useMealsStore().meals, usePlanStore().mealIds, extras.value),
	)

	const openItems = computed(() => items.value.filter((i) => !checked.value.has(i.key)))
	const doneItems = computed(() => items.value.filter((i) => checked.value.has(i.key)))

	const groups = computed(() =>
		groupItems(openItems.value, view.value, useMealsStore().meals, usePlanStore().mealIds),
	)

	/** Staples resting off the list — the shelf you tap to add from. */
	const shelvedStaples = computed(() =>
		extras.value
			.filter((e) => e.kind === 'staple' && !e.active)
			.sort((a, b) => a.name.localeCompare(b.name)),
	)

	const allStaples = computed(() =>
		extras.value.filter((e) => e.kind === 'staple').sort((a, b) => a.name.localeCompare(b.name)),
	)

	async function hydrate() {
		const [storedExtras, keys] = await Promise.all([
			extrasRepo.allExtras(),
			checkedRepo.checkedKeys(),
		])

		extras.value = storedExtras
		checked.value = new Set(keys)
	}

	async function toggle(key: string) {
		const next = !checked.value.has(key)

		// Reassign rather than mutate, so computeds relying on identity invalidate.
		const updated = new Set(checked.value)
		if (next) updated.add(key)
		else updated.delete(key)
		checked.value = updated

		await checkedRepo.setChecked(key, next)
	}

	/* ── Extras ───────────────────────────────────────────────────────────── */

	async function addExtra(
		name: string,
		store: Store,
		{ kind = 'oneoff' as ExtraKind, qty = '1', active = true } = {},
	): Promise<ExtraItem | undefined> {
		const trimmed = name.trim()
		if (!trimmed) return

		const extra: ExtraItem = {
			id: crypto.randomUUID(),
			name: trimmed,
			qty,
			store,
			kind,
			active,
			createdAt: Date.now(),
		}

		extras.value.push(extra)
		await extrasRepo.putExtra(extra)
		return extra
	}

	async function updateExtra(id: string, patch: Partial<Omit<ExtraItem, 'id' | 'createdAt'>>) {
		const existing = extras.value.find((e) => e.id === id)
		if (!existing) return

		const updated = { ...existing, ...patch }
		extras.value.splice(extras.value.indexOf(existing), 1, updated)
		await extrasRepo.putExtra(updated)
	}

	/**
	 * Delete an extra outright — the shelf's way of removing a staple, and the
	 * only path that does not involve buying it first.
	 *
	 * The checked key goes with it. Nothing derives that row any more, so a
	 * stale key is invisible rather than wrong, but it would outlive the record
	 * in IndexedDB until the next finished trip.
	 */
	async function removeExtra(id: string) {
		const key = extraKey(id)

		extras.value = extras.value.filter((e) => e.id !== id)

		if (checked.value.has(key)) {
			const updated = new Set(checked.value)
			updated.delete(key)
			checked.value = updated
		}

		await Promise.all([extrasRepo.deleteExtra(id), checkedRepo.setChecked(key, false)])
	}

	/** Move a shelved staple onto this week's list, or send it back. */
	async function setStapleActive(id: string, active: boolean) {
		await updateExtra(id, { active })
	}

	/**
	 * Flip an extra between a one-off and a staple.
	 *
	 * Promoting is how something you already typed becomes recurring, without
	 * retyping it — the whole point of the shelf. Demoting leaves it on the
	 * current list, so it still gets bought this trip, it just will not come back.
	 */
	async function toggleStaple(id: string) {
		const existing = extras.value.find((e) => e.id === id)
		if (!existing) return

		await updateExtra(id, { kind: existing.kind === 'staple' ? 'oneoff' : 'staple' })
	}

	/** Look up an extra by the shopping list key that refers to it. */
	function extraById(id: string | undefined) {
		return id ? extras.value.find((e) => e.id === id) : undefined
	}

	/* ── Clearing the cart ────────────────────────────────────────────────── */

	/**
	 * What clearing the cart would do, so the confirm dialog can spell it out
	 * before anything is destroyed.
	 *
	 * The three kinds of line have genuinely different lifecycles: a bought
	 * one-off is finished with, a staple goes back to the shelf until it is
	 * needed again, and a meal ingredient just unchecks because the meal is
	 * still planned.
	 */
	const cartClearPlan = computed(() => {
		const done = doneItems.value

		const oneOffsToDelete = done.filter((i) => i.extraKind === 'oneoff' && i.extraId)
		const staplesToShelve = done.filter((i) => i.extraKind === 'staple' && i.extraId)
		const ingredientsToUncheck = done.filter((i) => !i.isExtra)

		return { oneOffsToDelete, staplesToShelve, ingredientsToUncheck }
	})

	/**
	 * Finish a shopping trip: delete bought one-offs, return bought staples to
	 * the shelf, and uncheck everything else. Callers are expected to confirm
	 * first — see `cartClearPlan`.
	 */
	async function clearCart() {
		const { oneOffsToDelete, staplesToShelve } = cartClearPlan.value

		const deleteIds = oneOffsToDelete.map((i) => i.extraId!)
		const shelveIds = staplesToShelve.map((i) => i.extraId!)

		extras.value = extras.value
			.filter((e) => !deleteIds.includes(e.id))
			.map((e) => (shelveIds.includes(e.id) ? { ...e, active: false } : e))

		checked.value = new Set()

		await Promise.all([
			extrasRepo.deleteExtras(deleteIds),
			extrasRepo.setExtrasActive(shelveIds, false),
			checkedRepo.clearChecked(),
		])
	}

	/** Uncheck everything without deleting or shelving anything. */
	async function uncheckAll() {
		checked.value = new Set()
		await checkedRepo.clearChecked()
	}

	return {
		extras,
		checked,
		view,
		items,
		openItems,
		doneItems,
		groups,
		shelvedStaples,
		allStaples,
		cartClearPlan,
		hydrate,
		toggle,
		addExtra,
		updateExtra,
		removeExtra,
		setStapleActive,
		toggleStaple,
		extraById,
		clearCart,
		uncheckAll,
	}
})
