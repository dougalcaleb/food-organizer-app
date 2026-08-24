/*
Guards reordering a meal's ingredients.

The ordering itself is arithmetic and lives in `lib/dragSort.spec.ts` — happy-dom
has no layout, so a drag fired here would land in the same place whatever the
implementation did. What this file covers is everything around it: that the
order typed is the order saved, that the handle can be operated without a
pointer at all, and the handful of attributes and rules that the gesture is
silently dead without.
*/
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import BaseButton from '@/components/ui/BaseButton.vue'
import IngredientRow from '@/components/meal/IngredientRow.vue'
import MealEditorSheet from '@/components/meal/MealEditorSheet.vue'
import { DROP_SETTLE_MS } from '@/composables/useDragSort'
import { hydrateStores } from '@/stores'
import { useMealsStore } from '@/stores/meals'

beforeEach(async () => {
	document.body.innerHTML = ''
	setActivePinia(createPinia())
	await hydrateStores()
})

function mountEditor() {
	return mount(MealEditorSheet, { props: { open: true } })
}

type Editor = ReturnType<typeof mountEditor>

function rows(wrapper: Editor) {
	return wrapper.findAllComponents(IngredientRow)
}

function handles(wrapper: Editor) {
	return rows(wrapper).map((row) => row.get<HTMLButtonElement>('[aria-label="Reorder ingredient"]'))
}

/** Type an ingredient per line, leaving the editor with one row each. */
async function fill(wrapper: Editor, names: string[]) {
	for (const [index, name] of names.entries()) {
		const inputs = rows(wrapper).map((row) => row.get('input'))
		await inputs[index].setValue(name)

		if (index < names.length - 1) {
			await inputs[index].trigger('keydown.enter')
			await flushPromises()
		}
	}
}

/** Which row the drag is currently positioning, or -1. */
function liftedIndex(wrapper: Editor) {
	return rows(wrapper).findIndex((row) => row.find('[data-lifted]').exists())
}

function textOf(wrapper: Editor) {
	return rows(wrapper).map((row) => (row.get('input').element as HTMLInputElement).value)
}

async function save(wrapper: Editor) {
	const button = wrapper
		.findAllComponents(BaseButton)
		.find((candidate) => candidate.text() === 'Save')

	await button?.trigger('click')
	await flushPromises()
}

describe('reordering ingredients', () => {
	it('gives every row a handle to drag it by', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		expect(handles(wrapper)).toHaveLength(2)
	})

	it('moves a row down with the keyboard, and keeps the handle it was moved by', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic', 'ginger'])

		const handle = handles(wrapper)[0]
		handle.element.focus()

		await handle.trigger('keydown.down')
		await flushPromises()

		expect(textOf(wrapper)).toEqual(['garlic', 'onion', 'ginger'])
		// The same button, now in the second row: a second press has to carry on
		// moving the row that is being moved.
		expect(document.activeElement).toBe(handle.element)
		expect(handles(wrapper)[1].element).toBe(handle.element)
	})

	it('moves a row up with the keyboard', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		await handles(wrapper)[1].trigger('keydown.up')
		await flushPromises()

		expect(textOf(wrapper)).toEqual(['garlic', 'onion'])
	})

	it('does nothing at the ends of the list', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		await handles(wrapper)[0].trigger('keydown.up')
		await handles(wrapper)[1].trigger('keydown.down')
		await flushPromises()

		expect(textOf(wrapper)).toEqual(['onion', 'garlic'])
	})

	it('saves the meal in the order the rows are in', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic', 'ginger'])

		await handles(wrapper)[2].trigger('keydown.up')
		await flushPromises()
		await save(wrapper)

		const meal = useMealsStore().meals[0]

		expect(meal.ingredients.map((ingredient) => ingredient.name)).toEqual([
			'onion',
			'ginger',
			'garlic',
		])
	})
})

describe('a drag that outruns the handle', () => {
	/*
	The handle is 24px wide inside a 46px row, and the row is a frame behind the
	pointer by construction — so a drag of any speed at all leaves it. Everything
	here is about the gesture surviving that, which is the one part of the drag
	happy-dom can actually be asked about: no layout is involved in where the
	events are delivered.
	*/
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	async function grab(wrapper: Editor, index: number) {
		await handles(wrapper)[index].trigger('pointerdown', { pointerId: 1, clientY: 0 })
	}

	function releaseElsewhere() {
		// Not on the handle: by the time the button comes up the pointer is over
		// whatever the list has slid under it.
		window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
	}

	it('picks the row up', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		await grab(wrapper, 0)

		expect(liftedIndex(wrapper)).toBe(0)
	})

	it('ends when the pointer is released anywhere at all', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])
		await grab(wrapper, 0)

		releaseElsewhere()
		vi.advanceTimersByTime(DROP_SETTLE_MS)
		await nextTick()

		// Listening on the handle instead leaves the row stuck to the pointer,
		// lifted, with no button held down.
		expect(liftedIndex(wrapper)).toBe(-1)
	})

	it('ignores a second pointer arriving mid-drag', async () => {
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])
		await grab(wrapper, 0)

		window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }))
		vi.advanceTimersByTime(DROP_SETTLE_MS)
		await nextTick()

		expect(liftedIndex(wrapper)).toBe(0)
	})
})

describe('what the gesture depends on', () => {
	const row = readFileSync('src/components/meal/IngredientRow.vue', 'utf8')
	const editor = readFileSync('src/components/meal/MealEditorSheet.vue', 'utf8')

	it('takes the touch gesture away from the browser', async () => {
		/*
		Without `touch-action: none` the browser reads the same downward drag as a
		scroll of the sheet, claims the pointer and stops sending move events — the
		row is picked up and then simply does not follow. Nothing in happy-dom can
		show that, so this reads the class list.
		*/
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		for (const handle of handles(wrapper)) {
			expect(handle.classes()).toContain('touch-none')
			// The press-and-hold offers the browser makes over a button, both of
			// which have to be declined separately.
			expect(handle.classes()).toContain('select-none')
			expect(handle.classes()).toContain('touch-callout-none')
		}
	})

	it('marks each row as the thing being sorted', async () => {
		// `useDragSort` finds the row, and through it the container it is measured
		// in, by walking up from the handle. Without the attribute reaching the
		// row's own element the drag silently never starts at all.
		const wrapper = mountEditor()
		await fill(wrapper, ['onion', 'garlic'])

		for (const [index, handle] of handles(wrapper).entries()) {
			expect(handle.element.closest('[data-sortable]')).toBe(rows(wrapper)[index].element)
		}
	})

	it('keeps the move animation off the row under the finger', () => {
		/*
		The dragged row is positioned by the drag itself. Letting the FLIP move
		transition have it as well makes it trail the pointer by the length of the
		animation every time it passes a neighbour, which reads as the drag being
		laggy rather than as the animation being wrong.
		*/
		const rule = editor.match(/\.ing-move:has\(\[data-lifted\]\)\s*\{([^}]*)\}/)

		expect(rule?.[1]).toMatch(/transition:\s*none/)
	})

	it('marks the lifted row from inside it, not on the row', () => {
		/*
		TransitionGroup decides whether a move is animatable by cloning the first
		row — shallowly — and reading the clone's transition with the move class on
		it. Marking the row itself would therefore disable the animation for every
		row in the list whenever the top row was the one being dragged, which is
		exactly when a drag has only just started.
		*/
		const root = row.match(/<template>\s*<div([^>]*)>/)

		expect(root?.[1]).toBeDefined()
		expect(root?.[1]).not.toContain('data-lifted')
		expect(row).toMatch(/:data-lifted="[^"]*lifted/)
		// And nothing may put it back on the row from the outside.
		expect(editor).not.toMatch(/data-lifted=/)
	})

	it('does not transition the lift while the finger is down', () => {
		// Same trap, the other half of it: easing the row towards a finger that is
		// already there is the row lagging the hand.
		const lift = row.match(/const lift = computed\(\(\) => \(\{([\s\S]*?)\}\)\)/)

		expect(lift?.[1]).toMatch(/transition:[\s\S]*settling/)
	})
})
