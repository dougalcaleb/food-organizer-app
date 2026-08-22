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
}
