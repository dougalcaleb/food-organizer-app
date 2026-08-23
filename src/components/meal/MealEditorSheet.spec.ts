/*
Guards Enter inside the ingredient list.

Adding a row without moving the cursor into it reads as the key having done
nothing: the new row is off the bottom of a scrolled sheet, and typing carries
on in the row you were already in.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BaseButton from '@/components/ui/BaseButton.vue'
import IngredientRow from '@/components/meal/IngredientRow.vue'
import MealEditorSheet from '@/components/meal/MealEditorSheet.vue'
import { hydrateStores } from '@/stores'

beforeEach(async () => {
	document.body.innerHTML = ''
	setActivePinia(createPinia())
	await hydrateStores()
})

function mountEditor() {
	return mount(MealEditorSheet, { props: { open: true } })
}

/** The rows as Test Utils sees them — the sheet is teleported to the body. */
function rowsOf(wrapper: ReturnType<typeof mountEditor>) {
	return wrapper.findAllComponents(IngredientRow).map((row) => row.find('input'))
}

describe('ingredient rows', () => {
	it('starts with one empty row', () => {
		expect(rowsOf(mountEditor())).toHaveLength(1)
	})

	it('adds a row on Enter in the last one, and puts the cursor in it', async () => {
		const wrapper = mountEditor()

		await rowsOf(wrapper)[0].setValue('2 cans coconut milk')
		await rowsOf(wrapper)[0].trigger('keydown.enter')
		await flushPromises()

		const rows = rowsOf(wrapper)

		expect(rows).toHaveLength(2)
		expect(document.activeElement).toBe(rows[1].element)
	})

	it('moves to the next row rather than adding one, from a middle row', async () => {
		const wrapper = mountEditor()

		// Two rows, cursor sitting in the second.
		await rowsOf(wrapper)[0].trigger('keydown.enter')
		await flushPromises()

		await rowsOf(wrapper)[0].trigger('keydown.enter')
		await flushPromises()

		const rows = rowsOf(wrapper)

		expect(rows).toHaveLength(2)
		expect(document.activeElement).toBe(rows[1].element)
	})

	it('focuses the row that "Add ingredient" creates', async () => {
		const wrapper = mountEditor()

		// By component, not by selector: the sheet is teleported, so its markup is
		// not inside the wrapper's own element.
		const add = wrapper
			.findAllComponents(BaseButton)
			.find((button) => button.text().includes('Add ingredient'))
		await add?.trigger('click')
		await flushPromises()

		const rows = rowsOf(wrapper)

		expect(rows).toHaveLength(2)
		expect(document.activeElement).toBe(rows[1].element)
	})

	it('does not steal focus when a removed row is replaced', async () => {
		const wrapper = mountEditor()

		const remove = wrapper.findComponent(IngredientRow).find('[aria-label="Remove ingredient"]')
		await remove.trigger('click')
		await flushPromises()

		// The list is never empty, but nobody asked to type.
		expect(rowsOf(wrapper)).toHaveLength(1)
		expect(document.activeElement).not.toBe(rowsOf(wrapper)[0].element)
	})
})
