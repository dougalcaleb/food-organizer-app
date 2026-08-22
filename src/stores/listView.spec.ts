/*
The shopping view is a writable computed on the store: it reads through to the
configured default until the user picks something, then holds their choice for
the session. Worth testing directly — a writable computed reached through
Pinia's store proxy is exactly the kind of thing that silently becomes
read-only.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { hydrateStores } from '@/stores'
import { useListStore } from '@/stores/list'
import { useSettingsStore } from '@/stores/settings'

beforeEach(async () => {
	setActivePinia(createPinia())

	// Settings genuinely persist, so without a wipe one test's default leaks
	// into the next.
	await Promise.all([db.settings.clear(), db.extras.clear(), db.checked.clear()])
	await hydrateStores()
})

describe('shopping view', () => {
	it('starts on the configured default', async () => {
		await useSettingsStore().update({ defaultShopView: 'meal' })
		expect(useListStore().view).toBe('meal')
	})

	it('can be set through the store proxy', () => {
		const list = useListStore()
		list.view = 'all'
		expect(list.view).toBe('all')
	})

	it('keeps the user choice even when the default changes underneath it', async () => {
		const list = useListStore()
		list.view = 'all'

		await useSettingsStore().update({ defaultShopView: 'meal' })
		expect(list.view).toBe('all')
	})

	it('follows the default until a choice is made', async () => {
		const list = useListStore()
		expect(list.view).toBe('store')

		await useSettingsStore().update({ defaultShopView: 'all' })
		expect(list.view).toBe('all')
	})
})

describe('adding a one-off from the list', () => {
	it('ignores an empty name', async () => {
		const list = useListStore()
		expect(await list.addExtra('   ', 'costco')).toBeUndefined()
		expect(list.extras).toHaveLength(0)
	})

	it('lands on the open list immediately', async () => {
		const list = useListStore()
		await list.addExtra('paper towels', 'walmart')

		expect(list.openItems.map((i) => i.name)).toContain('paper towels')
	})

	it('groups a new one-off under the store it was given', async () => {
		const list = useListStore()
		await list.addExtra('paper towels', 'walmart')

		expect(list.groups.map((g) => g.title)).toEqual(['Walmart'])
	})
})
