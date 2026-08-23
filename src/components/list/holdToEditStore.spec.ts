/*
Guards the hold gesture that edits an extra's store on the shopping list.

A one-off added under the wrong store used to be unfixable — the only route was
to delete it and type it again — so this exists at all because there is no room
on a shopping row for another visible control. `ShoppingRow.spec.ts` says why:
the words are inert on purpose, because a stray tap there checks something off
and that error is only noticed at home.

That makes the hold's own release the interesting case. The browser still sends
a `click` when the finger comes up, so a hold that starts over the checkbox
would otherwise open the picker and check the item off in the same gesture.
*/
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ShoppingRow from '@/components/list/ShoppingRow.vue'
import { LONG_PRESS_MS } from '@/composables/useLongPress'

const item = { key: 'x:1', name: 'coconut milk', qty: '1', meta: 'one-off' }

function row(props: Record<string, unknown> = {}) {
	return mount(ShoppingRow, {
		props: { item, store: 'costco', ...props },
		global: { stubs: { FaIcon: true } },
	})
}

type Row = ReturnType<typeof row>

/** The store chips, which exist only while the editor is open. */
function chips(wrapper: Row) {
	return wrapper.findAll('.chip')
}

async function hold(wrapper: Row, ms = LONG_PRESS_MS) {
	await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
	vi.advanceTimersByTime(ms)
	await wrapper.vm.$nextTick()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('opening the store editor', () => {
	it('takes a hold, not a tap', async () => {
		const wrapper = row()

		await hold(wrapper, LONG_PRESS_MS - 50)
		expect(chips(wrapper)).toHaveLength(0)

		vi.advanceTimersByTime(50)
		await wrapper.vm.$nextTick()
		expect(chips(wrapper).length).toBeGreaterThan(0)
	})

	it('is cancelled by a press that turns into a scroll', async () => {
		const wrapper = row()

		await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
		await wrapper.trigger('pointermove', { clientX: 10, clientY: 90 })
		vi.advanceTimersByTime(LONG_PRESS_MS)
		await wrapper.vm.$nextTick()

		expect(chips(wrapper)).toHaveLength(0)
	})

	it('is cancelled by lifting off early', async () => {
		const wrapper = row()

		await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
		await wrapper.trigger('pointerup')
		vi.advanceTimersByTime(LONG_PRESS_MS)
		await wrapper.vm.$nextTick()

		expect(chips(wrapper)).toHaveLength(0)
	})

	it('does not happen on a row with no record behind it', async () => {
		// A meal ingredient's store belongs to the meal, and a cart row is bought.
		const wrapper = row({ store: undefined })

		await hold(wrapper)

		expect(chips(wrapper)).toHaveLength(0)
	})
})

describe('the click that ends the hold', () => {
	it('does not check the item off', async () => {
		const wrapper = row()

		await hold(wrapper)
		// The finger came up over the checkbox, which is where it started.
		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	it('does not swallow the next real tap', async () => {
		// The suppression is armed by a hold and cleared by the press after it —
		// otherwise a hold that ends over the inert text leaves it armed forever.
		const wrapper = row()

		await hold(wrapper)
		await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
		await wrapper.trigger('pointerup')
		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('toggle')).toHaveLength(1)
	})
})

describe('picking a store', () => {
	it('reports the new one and closes', async () => {
		const wrapper = row()
		await hold(wrapper)

		const walmart = chips(wrapper).find((c) => c.text() === 'Walmart')!
		await walmart.trigger('click')

		expect(wrapper.emitted('update:store')).toEqual([['walmart']])
		expect(chips(wrapper)).toHaveLength(0)
	})

	it('closes without a change when the current store is tapped', async () => {
		// The only way back out of a picker opened by accident.
		const wrapper = row()
		await hold(wrapper)

		const costco = chips(wrapper).find((c) => c.text() === 'Costco')!
		await costco.trigger('click')

		expect(wrapper.emitted('update:store')).toBeUndefined()
		expect(chips(wrapper)).toHaveLength(0)
	})

	it('offers every store, with the current one marked', async () => {
		const wrapper = row()
		await hold(wrapper)

		expect(chips(wrapper).map((c) => c.text())).toEqual(['Costco', 'Walmart', 'Either', 'Wherever'])
		expect(chips(wrapper).filter((c) => c.attributes('aria-pressed') === 'true')).toHaveLength(1)
	})
})
