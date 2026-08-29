import { useListStore } from './list'
import { useMealsStore } from './meals'
import { usePlanStore } from './plan'
import { useSettingsStore } from './settings'

/**
 * Load every store from IndexedDB. Awaited before mount so the first paint has
 * real data rather than flashing empty states.
 *
 * Settings comes first because the list store reads `defaultShopView` from it.
 */
export async function hydrateStores(): Promise<void> {
	await useSettingsStore().hydrate()
	await Promise.all([useMealsStore().hydrate(), usePlanStore().hydrate(), useListStore().hydrate()])

	/*
	Only now that every table is in can a checked key be judged orphaned —
	before this line a key with no item might simply be waiting for its meal.
	This is the sweep for anything that changed the list without going through
	the List view: a meal unplanned on the Plan tab, or an ingredient renamed in
	the editor, both of which can strand a key in the cart.
	*/
	await useListStore().clearOrphanedChecked()
}
