/*
Guards the two gestures on a planned meal in the shopping list's "From the
plan" section: tap adds everything the meal needs, hold opens its ingredients
so a subset can be picked.

It is the shopping row's gesture pair, with the roles of tap and hold matched to
this row's stakes rather than copied. The whole row is the tap target here,
which on a ShoppingRow would be a bug: there a stray tap moves a line into the
cart and is noticed at home, while here it adds a meal's ingredients, visible
immediately and undone by tapping the same row again.

The hold's own release still arrives as a `click`, so without `consumeClick`
holding a row would open the ingredients and add the whole meal in one gesture.
*/
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlannedMealRow from '@/components/list/PlannedMealRow.vue'
import { LONG_PRESS_MS } from '@/composables/useLongPress'
import type { Meal } from '@/types'

const curry: Meal = {
	id: 'curry',
	name: 'Curry',
	tags: [],
	notes: '',
	lastMadeAt: null,
	ingredients: [
		{ name: 'coconut milk', amount: 2, unit: 'cans', store: 'costco' },
		{ name: 'chicken thighs', amount: 1.5, unit: 'lb', store: 'costco' },
	],
	createdAt: 0,
	updatedAt: 0,
	archived: false,
}

function row(props: Record<string, unknown> = {}) {
	return mount(PlannedMealRow, {
		props: { meal: curry, pulled: [], meta: '2 ingredients', expanded: false, ...props },
		global: { stubs: { FaIcon: true } },
	})
}

type Row = ReturnType<typeof row>

async function hold(wrapper: Row, ms = LONG_PRESS_MS) {
	await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
	vi.advanceTimersByTime(ms)
	await wrapper.vm.$nextTick()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('tapping a planned meal', () => {
	it('asks for the whole meal', async () => {
		const wrapper = row()
		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('tap')).toHaveLength(1)
	})

	it('reads as pressed once everything it needs is on the list', () => {
		const pulled = row({ pulled: ['coconut milk', 'chicken thighs'] })
		expect(pulled.get('button').attributes('aria-pressed')).toBe('true')
		expect(row().get('button').attributes('aria-pressed')).toBe('false')
	})

	it('does nothing on a meal with no ingredients yet', async () => {
		const bare = row({ meal: { ...curry, ingredients: [] } })

		expect(bare.get('button').attributes('disabled')).toBeDefined()
		// Nor does an empty meal read as fully on the list.
		expect(bare.get('button').attributes('aria-pressed')).toBe('false')

		// And it takes neither gesture: a hold opening an empty panel would read
		// as the app hanging on the vibration.
		await hold(bare)
		expect(bare.emitted('hold')).toBeUndefined()
	})
})

describe('holding a planned meal', () => {
	it('asks to open its ingredients, and a tap does not', async () => {
		const wrapper = row()

		await hold(wrapper, LONG_PRESS_MS - 50)
		expect(wrapper.emitted('hold')).toBeUndefined()

		vi.advanceTimersByTime(50)
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('hold')).toHaveLength(1)
	})

	it('is cancelled by a press that turns into a scroll', async () => {
		const wrapper = row()

		await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
		await wrapper.trigger('pointermove', { clientX: 10, clientY: 90 })
		vi.advanceTimersByTime(LONG_PRESS_MS)
		await wrapper.vm.$nextTick()

		expect(wrapper.emitted('hold')).toBeUndefined()
	})

	it('does not also add the whole meal when the finger comes up', async () => {
		const wrapper = row()

		await hold(wrapper)
		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('tap')).toBeUndefined()
	})

	it('does not swallow the next real tap', async () => {
		const wrapper = row()

		await hold(wrapper)
		await wrapper.trigger('pointerdown', { clientX: 10, clientY: 10 })
		await wrapper.trigger('pointerup')
		await wrapper.get('button').trigger('click')

		expect(wrapper.emitted('tap')).toHaveLength(1)
	})
})

describe('picking single ingredients', () => {
	/** Every button except the meal's own row button. */
	function ingredients(wrapper: Row) {
		return wrapper.findAll('button').slice(1)
	}

	it('shows nothing until the row is expanded', () => {
		expect(ingredients(row())).toHaveLength(0)
	})

	it('offers one control per ingredient, marking the ones on the list', () => {
		const wrapper = row({ expanded: true, pulled: ['coconut milk'] })
		const buttons = ingredients(wrapper)

		expect(buttons).toHaveLength(2)
		expect(buttons[0].attributes('aria-pressed')).toBe('true')
		expect(buttons[1].attributes('aria-pressed')).toBe('false')
	})

	it('reports the ingredient by name, not by index', async () => {
		const wrapper = row({ expanded: true })
		await ingredients(wrapper)[1].trigger('click')

		expect(wrapper.emitted('pick')).toEqual([['chicken thighs']])
	})

	it('shows each ingredient with its own amount', () => {
		const wrapper = row({ expanded: true })
		expect(ingredients(wrapper)[0].text()).toContain('2 cans')
	})
})
