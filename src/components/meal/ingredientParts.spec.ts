/*
Guards ingredient parts in the meal editor — "Sauce", "Marinade", the bits a
recipe is built out of.

The whole design is that a part is a HEADING IN THE SAME FLAT LIST as the
ingredients, not a box around them. Everything here is about that holding: the
headings sort alongside the rows, an ingredient's part is read off which heading
it sits under, and a meal that never gets one is unchanged in every respect.

The arithmetic of the drag itself is in `lib/dragSort.spec.ts` and the stamping
in `lib/mealDraft.spec.ts`; happy-dom has no layout, so a real drag fired here
would land in the same slot whatever the implementation did. What is tested here
is the keyboard half of the same move, which needs no layout at all.
*/
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BaseButton from '@/components/ui/BaseButton.vue'
import IngredientPartRow from '@/components/meal/IngredientPartRow.vue'
import IngredientRow from '@/components/meal/IngredientRow.vue'
import MealEditorSheet from '@/components/meal/MealEditorSheet.vue'
import { db } from '@/db'
import { hydrateStores } from '@/stores'
import { useMealsStore } from '@/stores/meals'
import type { Meal } from '@/types'

beforeEach(async () => {
	document.body.innerHTML = ''
	// fake-indexeddb outlives a test case, and a fresh Pinia does not clear it —
	// a meal left behind by the previous test is another row in `meals[0]`.
	await Promise.all([db.meals.clear(), db.plan.clear(), db.pulls.clear()])
	setActivePinia(createPinia())
	await hydrateStores()
})

function mountEditor(mealId?: string) {
	return mount(MealEditorSheet, { props: { open: true, mealId } })
}

type Editor = ReturnType<typeof mountEditor>

function ingredientRows(wrapper: Editor) {
	return wrapper.findAllComponents(IngredientRow)
}

function partRows(wrapper: Editor) {
	return wrapper.findAllComponents(IngredientPartRow)
}

function button(wrapper: Editor, label: string) {
	return wrapper.findAllComponents(BaseButton).find((b) => b.text().includes(label))
}

async function addPart(wrapper: Editor, name: string) {
	await button(wrapper, 'Add part')?.trigger('click')
	await flushPromises()

	const row = partRows(wrapper).at(-1)!
	await row.get('input').setValue(name)
	return row
}

async function save(wrapper: Editor) {
	await button(wrapper, 'Save')?.trigger('click')
	await flushPromises()
}

function saved(id?: string): Meal {
	const meals = useMealsStore()
	return (id ? meals.get(id) : meals.meals[0])!
}

/**
 * The sortable children of the list, in document order, by kind.
 *
 * Queried off the document rather than the wrapper: the sheet is teleported to
 * the body, so its markup is not inside the wrapper's own element and
 * `wrapper.findAll` comes back empty.
 */
function listKinds(wrapper: Editor) {
	const rows = [...document.querySelectorAll('[data-sortable]')]
	const parts = partRows(wrapper).map((row) => row.element)

	return rows.map((row) => (parts.includes(row as HTMLElement) ? 'part' : 'ingredient'))
}

describe('adding a part', () => {
	it('is optional, and a meal saved without one has no parts at all', async () => {
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('onion')
		await save(wrapper)

		expect(saved().ingredients).toEqual([{ name: 'onion' }])
	})

	it('adds a heading and puts the cursor in it', async () => {
		// Same rule as adding an ingredient row: a heading nobody has named is not
		// a part, so asking for one is asking to type its name.
		const wrapper = mountEditor()
		await button(wrapper, 'Add part')?.trigger('click')
		await flushPromises()

		const row = partRows(wrapper)[0]

		expect(row.exists()).toBe(true)
		expect(document.activeElement).toBe(row.get('input').element)
	})

	it('stamps the rows typed under it', async () => {
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('rice')

		await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()
		await ingredientRows(wrapper).at(-1)!.get('input').setValue('fish sauce')

		await save(wrapper)

		expect(saved().ingredients).toEqual([{ name: 'rice' }, { name: 'fish sauce', part: 'Sauce' }])
	})

	it('colours the rows belonging to it, and only those', async () => {
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('rice')

		const heading = await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()

		const [above, below] = ingredientRows(wrapper)

		// The band is the only thing that can say "this belongs to the sauce": the
		// rows are siblings of the heading, not children of it.
		expect(above.classes()).not.toContain('part-band')
		expect(below.classes()).toContain('part-band')
		expect(below.classes()).toContain('part-1')
		expect(heading.classes()).toContain('part-1')
	})

	it('gives a second part a different colour', async () => {
		const wrapper = mountEditor()
		const first = await addPart(wrapper, 'Sauce')
		const second = await addPart(wrapper, 'Base')

		expect(first.classes()).toContain('part-1')
		expect(second.classes()).toContain('part-2')
	})

	it('shows no band until the heading has a name', async () => {
		const wrapper = mountEditor()
		await button(wrapper, 'Add part')?.trigger('click')
		await flushPromises()

		expect(partRows(wrapper)[0].classes()).not.toContain('part-band')
	})
})

describe('moving an ingredient between parts', () => {
	/*
	The point of one flat list: this move is the ordinary reorder, and there is no
	membership to update afterwards. If these ever diverge, it is because someone
	has started storing the part on the row instead of reading it off the order.
	*/
	it('leaves a row above the heading in no part', async () => {
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('lime')
		await addPart(wrapper, 'Sauce')
		await save(wrapper)

		expect(saved().ingredients).toEqual([{ name: 'lime' }])
	})

	it('takes the row into the part when the heading is moved above it', async () => {
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('lime')
		await addPart(wrapper, 'Sauce')

		// Exactly the reorder any row takes, from the heading's own handle.
		await partRows(wrapper)[0].get('[aria-label="Reorder part"]').trigger('keydown.up')
		await flushPromises()
		await save(wrapper)

		expect(saved().ingredients).toEqual([{ name: 'lime', part: 'Sauce' }])
	})

	it('moves a row out of a part by moving it above the heading', async () => {
		const wrapper = mountEditor()
		await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()
		await ingredientRows(wrapper).at(-1)!.get('input').setValue('lime')

		// The blank row the editor always opens with is still above the heading.
		expect(listKinds(wrapper)).toEqual(['ingredient', 'part', 'ingredient'])

		const handle = ingredientRows(wrapper).at(-1)!.get('[aria-label="Reorder ingredient"]')
		await handle.trigger('keydown.up')
		await flushPromises()

		expect(listKinds(wrapper)).toEqual(['ingredient', 'ingredient', 'part'])

		await save(wrapper)
		expect(saved().ingredients).toEqual([{ name: 'lime' }])
	})

	it('sorts headings and ingredients as one list of siblings', async () => {
		// The drag measures the children of one container and reads the order back
		// as membership, so a heading that was not among them could not be moved
		// and an ingredient could never pass one.
		const wrapper = mountEditor()
		await ingredientRows(wrapper)[0].get('input').setValue('rice')
		await addPart(wrapper, 'Sauce')

		expect(listKinds(wrapper)).toEqual(['ingredient', 'part'])
		expect(partRows(wrapper)[0].attributes('data-sortable')).toBeDefined()
	})
})

describe('removing a part', () => {
	it('dissolves it without touching the ingredients in it', async () => {
		const wrapper = mountEditor()
		await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()
		await ingredientRows(wrapper).at(-1)!.get('input').setValue('lime')

		await partRows(wrapper)[0].get('[aria-label="Remove part"]').trigger('click')
		await flushPromises()

		expect(partRows(wrapper)).toHaveLength(0)
		// The blank row the editor opens with, and the one that was in the part.
		expect(ingredientRows(wrapper)).toHaveLength(2)

		await save(wrapper)
		expect(saved().ingredients).toEqual([{ name: 'lime' }])
	})

	it('also dissolves it when the name is cleared', async () => {
		const wrapper = mountEditor()
		await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()
		await ingredientRows(wrapper).at(-1)!.get('input').setValue('lime')

		await partRows(wrapper)[0].get('input').setValue('')
		await save(wrapper)

		expect(saved().ingredients).toEqual([{ name: 'lime' }])
	})
})

describe('editing a meal that has parts', () => {
	it('reads the headings back out of the order they were saved in', async () => {
		const meals = useMealsStore()
		const meal = await meals.create({
			name: 'Chicken and rice',
			ingredients: [
				{ name: 'rice' },
				{ name: 'chicken', part: 'Marinade' },
				{ name: 'yogurt', part: 'Marinade' },
				{ name: 'lime', part: 'Sauce' },
			],
		})

		const wrapper = mountEditor(meal.id)
		await flushPromises()

		expect(listKinds(wrapper)).toEqual([
			'ingredient',
			'part',
			'ingredient',
			'ingredient',
			'part',
			'ingredient',
		])

		expect(
			partRows(wrapper).map((row) => (row.get('input').element as HTMLInputElement).value),
		).toEqual(['Marinade', 'Sauce'])
	})

	it('round-trips unchanged through a save', async () => {
		const ingredients = [
			{ name: 'chicken', part: 'Marinade' },
			{ name: 'lime', part: 'Sauce' },
			{ name: 'fish sauce', part: 'Sauce' },
		]
		const meals = useMealsStore()
		const meal = await meals.create({ name: 'Chicken and rice', ingredients })

		const wrapper = mountEditor(meal.id)
		await flushPromises()
		await save(wrapper)

		expect(saved(meal.id).ingredients).toEqual(ingredients)
	})
})

describe('what the colour band depends on', () => {
	/*
	The band is a left stripe plus a wash of the same hue, and exactly one of
	those two can be taken away without the bug being obvious: an all-sides
	border-COLOUR utility on the same element — `border-border`, which every row
	in the app uses for its divider — outranks `.part-band`, because Tailwind's
	utilities layer comes after the components layer. The stripe goes gray, the
	wash stays, and the feature reads as working. One-sided colour utilities
	(`border-b-border`, `border-t-border`) touch only the edge they name.
	*/
	it('keeps the row divider off the stripe in the editor', async () => {
		const wrapper = mountEditor()
		const heading = await addPart(wrapper, 'Sauce')
		await button(wrapper, 'Add ingredient')?.trigger('click')
		await flushPromises()

		for (const row of [heading, ingredientRows(wrapper).at(-1)!]) {
			expect(row.classes()).toContain('part-band')
			expect(row.classes()).toContain('border-b-border')
			expect(row.classes()).not.toContain('border-border')
		}
	})

	it('keeps the group divider off the stripe in the detail sheet', () => {
		// Read as text: mounting the sheet proves nothing here, since no test
		// environment resolves a cascade.
		const source = readFileSync('src/components/meal/MealDetailSheet.vue', 'utf8')
		const start = source.indexOf('part-band')
		const binding = source.slice(start, source.indexOf(']', start))

		expect(start).toBeGreaterThan(-1)
		expect(binding).toContain('border-t-border')
		expect(binding).not.toContain("'border-t border-border'")
	})
})
