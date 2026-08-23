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
import { extraIdFromKey } from '@/lib/shoppingList'
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

describe('creating and promoting staples', () => {
	it('can create a staple directly, not just a one-off', async () => {
		const list = useListStore()
		const extra = await list.addExtra('milk', 'either', { kind: 'staple' })

		expect(extra?.kind).toBe('staple')
		expect(list.allStaples.map((s) => s.name)).toEqual(['milk'])
	})

	it('a new staple starts on the list, not on the shelf', async () => {
		const list = useListStore()
		await list.addExtra('milk', 'either', { kind: 'staple' })

		expect(list.openItems.map((i) => i.name)).toContain('milk')
		expect(list.shelvedStaples).toEqual([])
	})

	/*
	The shelf editor asks for the opposite, and has to: adding one there is
	describing something bought regularly, not shopping. Landing on this week's
	list would be a surprise every time the shelf is tidied.
	*/
	it('can be created straight onto the shelf instead', async () => {
		const list = useListStore()
		await list.addExtra('milk', 'either', { kind: 'staple', active: false })

		expect(list.shelvedStaples.map((s) => s.name)).toEqual(['milk'])
		expect(list.openItems.map((i) => i.name)).not.toContain('milk')
	})

	it('promotes an existing one-off without retyping it', async () => {
		const list = useListStore()
		const extra = await list.addExtra('butter', 'costco')
		expect(extra?.kind).toBe('oneoff')

		await list.toggleStaple(extra!.id)

		expect(list.allStaples.map((s) => s.name)).toEqual(['butter'])
		// Still on the list — promoting changes its future, not this trip.
		expect(list.openItems.map((i) => i.name)).toContain('butter')
	})

	it('demotes a staple back to a one-off', async () => {
		const list = useListStore()
		const extra = await list.addExtra('butter', 'costco', { kind: 'staple' })

		await list.toggleStaple(extra!.id)
		expect(list.allStaples).toEqual([])
	})

	it('changes what finishing the trip does to it', async () => {
		const list = useListStore()
		const extra = await list.addExtra('butter', 'costco')
		await list.toggleStaple(extra!.id)
		await list.toggle(list.openItems.find((i) => i.name === 'butter')!.key)

		// As a one-off it would have been deleted; as a staple it is shelved.
		expect(list.cartClearPlan.oneOffsToDelete).toEqual([])
		expect(list.cartClearPlan.staplesToShelve.map((i) => i.name)).toEqual(['butter'])
	})

	it('survives a promotion across a reload', async () => {
		const list = useListStore()
		const extra = await list.addExtra('butter', 'costco')
		await list.toggleStaple(extra!.id)

		setActivePinia(createPinia())
		await hydrateStores()

		expect(useListStore().allStaples.map((s) => s.name)).toEqual(['butter'])
	})

	it('resolves an extra from its shopping list key', async () => {
		const list = useListStore()
		const extra = await list.addExtra('butter', 'costco')
		const key = list.openItems.find((i) => i.name === 'butter')!.key

		expect(list.extraById(extraIdFromKey(key))?.id).toBe(extra!.id)
		// A meal-ingredient key resolves to nothing.
		expect(extraIdFromKey('coconut milk')).toBeUndefined()
	})
})

/*
Deleting a staple from the shelf. Before this existed the only way to be rid of
one was to put it on the list, demote it to a one-off, check it off and finish
the trip — four steps, one of which was buying it.
*/
describe('deleting a staple', () => {
	it('removes it from the shelf for good', async () => {
		const list = useListStore()
		const extra = await list.addExtra('milk', 'either', { kind: 'staple', active: false })

		await list.removeExtra(extra!.id)

		expect(list.allStaples).toEqual([])
		expect(await db.extras.count()).toBe(0)
	})

	it('takes it off the current list too, checked or not', async () => {
		const list = useListStore()
		const extra = await list.addExtra('milk', 'either', { kind: 'staple' })
		await list.toggle(list.openItems.find((i) => i.name === 'milk')!.key)

		await list.removeExtra(extra!.id)

		expect(list.openItems.map((i) => i.name)).not.toContain('milk')
		expect(list.doneItems.map((i) => i.name)).not.toContain('milk')
	})

	// The row is gone either way; the key would just outlive its record on disk.
	it('does not leave its checked key behind', async () => {
		const list = useListStore()
		const extra = await list.addExtra('milk', 'either', { kind: 'staple' })
		await list.toggle(list.openItems.find((i) => i.name === 'milk')!.key)
		expect(await db.checked.count()).toBe(1)

		await list.removeExtra(extra!.id)
		expect(await db.checked.count()).toBe(0)

		setActivePinia(createPinia())
		await hydrateStores()
		expect(useListStore().checked.size).toBe(0)
	})
})
