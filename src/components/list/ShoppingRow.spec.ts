/*
Guards which part of a shopping row checks an item off.

Only the checkbox does. Making the whole row the target is the tempting change
— it is more forgiving, it is what the row looked like first, and nothing about
the markup argues against it — so this is here to say no on purpose.

The asymmetry is the reason. A missed tap is noticed and repeated a second
later. A stray one moves the line into the cart, out of the section being read,
and is noticed at home without the thing it was hiding.
*/
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShoppingRow from '@/components/list/ShoppingRow.vue'

const item = {
	key: 'x:1',
	name: 'coconut milk',
	qty: '3 cans',
	meta: 'Weeknight red curry',
}

function row(props: Record<string, unknown> = {}) {
	return mount(ShoppingRow, {
		props: { item, ...props },
		global: { stubs: { FaIcon: true } },
	})
}

/** Every element in the row that is not part of some button. */
function inertParts(wrapper: ReturnType<typeof row>) {
	return wrapper.findAll('*').filter((el) => !el.element.closest('button'))
}

describe('checking an item off', () => {
	it('happens when the checkbox is tapped', async () => {
		const wrapper = row()

		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('toggle')).toHaveLength(1)
	})

	it('still works through the tick inside the box', async () => {
		// The button is the target, but the tap lands on whatever is drawn there.
		const wrapper = row({ checked: true })

		await wrapper.get('button > span').trigger('click')

		expect(wrapper.emitted('toggle')).toHaveLength(1)
	})

	it('finds the parts of the row that are not buttons', () => {
		// Without this, an empty selection would pass the next case vacuously.
		expect(inertParts(row()).length).toBeGreaterThan(0)
	})

	it('does not happen from the name, the quantity or the meta line', async () => {
		const wrapper = row()

		// A click on any of these bubbles to the row, so a handler put back on the
		// row itself — the whole point of this guard — fails here too.
		for (const part of inertParts(wrapper)) await part.trigger('click')
		await wrapper.trigger('click')

		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	it('does not happen from the staple control', async () => {
		const wrapper = row({ canPin: true })
		const pin = wrapper.findAll('button').at(-1)!

		await pin.trigger('click')

		expect(wrapper.emitted('pin')).toHaveLength(1)
		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	it('names the checkbox, which has no text of its own', () => {
		expect(row().get('button').attributes('aria-label')).toContain('coconut milk')
		expect(row({ checked: true }).get('button').attributes('aria-pressed')).toBe('true')
	})
})
