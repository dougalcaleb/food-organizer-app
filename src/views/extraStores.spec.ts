/*
Where an extra's store comes from, and where it can be changed afterwards.

Both halves were wrong in the same direction: the store was decided once, at
the moment of typing, and then frozen. A one-off added under the wrong heading
could only be deleted and retyped, and a staple's store could not be reached at
all once it was on the shelf.

The default is the other half of that. Costco was the first one, which made a
concrete claim about every item added without a glance at the chips; the chips
are below the input and the whole point of that input is typing something
one-handed in a shop. `wherever` is the one answer that is never wrong.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ListView from '@/views/ListView.vue'
import StapleShelf from '@/components/list/StapleShelf.vue'
import { db } from '@/db'
import { hydrateStores } from '@/stores'
import { useListStore } from '@/stores/list'

beforeEach(async () => {
	setActivePinia(createPinia())
	// Settings and extras both survive between cases in a file — fake-indexeddb
	// keeps its state and a fresh Pinia is not enough on its own.
	await Promise.all([db.extras.clear(), db.checked.clear(), db.settings.clear()])
	await hydrateStores()
})

const stubs = { FaIcon: true }

/** The chips in some part of the tree, by label. */
function chipLabels(wrapper: { findAll: (s: string) => { text: () => string }[] }) {
	return wrapper.findAll('.chip').map((c) => c.text())
}

describe('adding a one-off', () => {
	it('defaults to Wherever, not a real store', async () => {
		const wrapper = mount(ListView, { global: { stubs } })

		await wrapper.get('input').setValue('parchment paper')
		await wrapper.get('button.btn-primary').trigger('click')
		await flushPromises()

		const [extra] = useListStore().extras
		expect(extra.name).toBe('parchment paper')
		expect(extra.store).toBe('wherever')
	})

	it('still takes a store chosen before adding', async () => {
		const wrapper = mount(ListView, { global: { stubs } })

		const walmart = wrapper.findAll('.chip').find((c) => c.text() === 'Walmart')!
		await walmart.trigger('click')
		await wrapper.get('input').setValue('paprika')
		await wrapper.get('button.btn-primary').trigger('click')
		await flushPromises()

		expect(useListStore().extras[0].store).toBe('walmart')
	})
})

describe('correcting a one-off already on the list', () => {
	it('writes the new store through to the database', async () => {
		const list = useListStore()
		const extra = (await list.addExtra('parchment paper', 'wherever'))!

		const wrapper = mount(ListView, { global: { stubs } })
		const row = wrapper.getComponent({ name: 'ShoppingRow' })

		await row.trigger('pointerdown', { clientX: 0, clientY: 0 })
		await new Promise((resolve) => setTimeout(resolve, 600))
		await wrapper.vm.$nextTick()

		const costco = row.findAll('.chip').find((c) => c.text() === 'Costco')!
		await costco.trigger('click')
		await flushPromises()

		expect(list.extraById(extra.id)!.store).toBe('costco')
		expect((await db.extras.get(extra.id))!.store).toBe('costco')
	})
})

describe('a staple on the shelf', () => {
	it('shows no store picker until the shelf is being edited', async () => {
		const list = useListStore()
		await list.addExtra('olive oil', 'costco', { kind: 'staple', active: false })

		const wrapper = mount(StapleShelf, { global: { stubs } })

		// Closed, the shelf is the one-tap "put this on the list" row of chips.
		expect(chipLabels(wrapper)).toEqual(['olive oil'])
	})

	it('can have its store changed in edit mode', async () => {
		const list = useListStore()
		const staple = (await list.addExtra('olive oil', 'costco', {
			kind: 'staple',
			active: false,
		}))!

		const wrapper = mount(StapleShelf, { global: { stubs } })
		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Edit')!
			.trigger('click')
		await wrapper.vm.$nextTick()

		// Two pickers now: the one for the staple being typed, and this one.
		const picker = wrapper.findAllComponents({ name: 'StorePicker' }).at(-1)!
		await picker
			.findAll('.chip')
			.find((c) => c.text() === 'Either')!
			.trigger('click')
		await flushPromises()

		expect(list.extraById(staple.id)!.store).toBe('either')
		expect((await db.extras.get(staple.id))!.store).toBe('either')
	})
})
