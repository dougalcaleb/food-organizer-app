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

The same editor renames the item, for the same reason it re-stores it: a typo
was otherwise only fixable by buying the thing and typing it again. The name is
a draft until something commits it, so what each way out of the editor does
with that draft is the rest of what is guarded here.
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

/** The name field, which exists only while the editor is open. */
function nameField(wrapper: Row) {
	return wrapper.find('input')
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

describe('renaming the item', () => {
	it('opens on the name it already has', async () => {
		const wrapper = row()
		await hold(wrapper)

		expect((nameField(wrapper).element as HTMLInputElement).value).toBe('coconut milk')
	})

	it('reports the new name on Enter, and closes', async () => {
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).setValue('coconut cream')
		await nameField(wrapper).trigger('keydown.enter')

		expect(wrapper.emitted('update:name')).toEqual([['coconut cream']])
		expect(chips(wrapper)).toHaveLength(0)
	})

	it('keeps a rename made on the way out through the store chips', async () => {
		// Picking a store is the other exit, and it must not discard the draft.
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).setValue('coconut cream')
		await chips(wrapper)
			.find((c) => c.text() === 'Walmart')!
			.trigger('click')

		expect(wrapper.emitted('update:name')).toEqual([['coconut cream']])
		expect(wrapper.emitted('update:store')).toEqual([['walmart']])
	})

	it('commits on blur, so tapping away does not lose the edit', async () => {
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).setValue('coconut cream')
		await nameField(wrapper).trigger('blur')

		expect(wrapper.emitted('update:name')).toEqual([['coconut cream']])
	})

	it('reports nothing when the name is untouched', async () => {
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).trigger('keydown.enter')

		expect(wrapper.emitted('update:name')).toBeUndefined()
	})

	it('refuses to blank the name', async () => {
		// Only `name` is ever required, so there is no rename that removes it —
		// and an emptied field is what clearing one to retype it looks like.
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).setValue('   ')
		await nameField(wrapper).trigger('keydown.enter')

		expect(wrapper.emitted('update:name')).toBeUndefined()
	})

	it('does not commit twice when the editor closes over the field', async () => {
		// Closing unmounts the input, and a blur on the way out would otherwise
		// send the same rename a second time.
		const wrapper = row()
		await hold(wrapper)

		// Held onto, because closing takes the field out of the DOM — the handler
		// is still on the element, which is what a late blur would reach.
		const field = nameField(wrapper)

		await field.setValue('coconut cream')
		await field.trigger('keydown.enter')
		await field.trigger('blur')

		expect(wrapper.emitted('update:name')).toHaveLength(1)
	})

	it('is not shut by a press held inside its own name field', async () => {
		// Placing the caret is a press like any other, and the row's hold timer
		// is listening one element up.
		const wrapper = row()
		await hold(wrapper)

		await nameField(wrapper).trigger('pointerdown', { clientX: 10, clientY: 10 })
		vi.advanceTimersByTime(LONG_PRESS_MS)
		await wrapper.vm.$nextTick()

		expect(chips(wrapper).length).toBeGreaterThan(0)
	})
})
