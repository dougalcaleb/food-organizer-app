import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as checkedRepo from '@/db/repositories/checked'
import * as extrasRepo from '@/db/repositories/extras'
import { buildItems, groupItems } from '@/lib/shoppingList'
import type { ExtraItem, ShopView, Store } from '@/types'
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

		// Set mutation is reactive in Vue 3, but reassign so computeds relying on
		// identity also invalidate.
		const updated = new Set(checked.value)
		if (next) updated.add(key)
		else updated.delete(key)
		checked.value = updated

		await checkedRepo.setChecked(key, next)
	}

	/** Empties the cart — used after a shopping trip. */
	async function clearChecked() {
		checked.value = new Set()
		await checkedRepo.clearChecked()
	}

	async function addExtra(name: string, store: Store, qty = '1') {
		const trimmed = name.trim()
		if (!trimmed) return

		const extra: ExtraItem = {
			id: crypto.randomUUID(),
			name: trimmed,
			qty,
			store,
			createdAt: Date.now(),
		}

		extras.value.push(extra)
		await extrasRepo.putExtra(extra)
	}

	async function removeExtra(id: string) {
		extras.value = extras.value.filter((e) => e.id !== id)
		await extrasRepo.deleteExtra(id)
	}

	return {
		extras,
		checked,
		view,
		items,
		openItems,
		doneItems,
		groups,
		hydrate,
		toggle,
		clearChecked,
		addExtra,
		removeExtra,
	}
})
