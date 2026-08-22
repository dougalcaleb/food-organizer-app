import { describe, expect, it } from 'vitest'
import { draftHasContent, draftIngredients, draftToPayload, UNTITLED } from './mealDraft'
import type { MealDraft } from './mealDraft'

function draft(overrides: Partial<MealDraft> = {}): MealDraft {
	return { name: '', notes: '', tags: [], rows: [{ text: '' }], ...overrides }
}

describe('draftToPayload — what counts as worth saving', () => {
	it('discards a wholly blank draft', () => {
		expect(draftToPayload(draft())).toBeNull()
	})

	it('discards a draft of nothing but whitespace', () => {
		expect(draftToPayload(draft({ name: '   ', notes: '  ', rows: [{ text: ' ' }] }))).toBeNull()
	})

	it('saves a draft with only a name', () => {
		expect(draftToPayload(draft({ name: 'that thai place thing' }))).toMatchObject({
			name: 'that thai place thing',
			ingredients: [],
			tags: [],
		})
	})

	it('keeps an untitled draft that has ingredients', () => {
		const payload = draftToPayload(draft({ rows: [{ text: '2 cans coconut milk' }] }))

		expect(payload?.name).toBe(UNTITLED)
		expect(payload?.ingredients).toEqual([{ name: 'coconut milk', amount: 2, unit: 'cans' }])
	})

	it('keeps an untitled draft that has only notes', () => {
		expect(draftToPayload(draft({ notes: 'the one with the crispy bits' }))?.name).toBe(UNTITLED)
	})

	it('keeps an untitled draft that has only tags', () => {
		expect(draftToPayload(draft({ tags: ['Thai'] }))?.name).toBe(UNTITLED)
	})

	it('trims the name it saves', () => {
		expect(draftToPayload(draft({ name: '  Baked ziti  ' }))?.name).toBe('Baked ziti')
	})
})

describe('draftIngredients', () => {
	it('drops blank rows without dropping real ones', () => {
		const rows = [{ text: 'olive oil' }, { text: '   ' }, { text: '2 cans coconut milk' }]
		expect(draftIngredients(rows).map((i) => i.name)).toEqual(['olive oil', 'coconut milk'])
	})

	it('omits absent fields entirely rather than storing undefined', () => {
		// Matters for persistence: `{ name, amount: undefined }` does not survive
		// a JSON round trip the same way `{ name }` does.
		expect(draftIngredients([{ text: 'olive oil' }])).toEqual([{ name: 'olive oil' }])
	})

	it('carries the row store through', () => {
		expect(draftIngredients([{ text: 'olive oil', store: 'costco' }])).toEqual([
			{ name: 'olive oil', store: 'costco' },
		])
	})

	it('leaves the store off when none was picked', () => {
		expect(draftIngredients([{ text: 'olive oil' }])[0].store).toBeUndefined()
	})
})

describe('draftHasContent', () => {
	it('ignores rows that parse to nothing', () => {
		expect(draftHasContent(draft({ rows: [{ text: '  ' }, { text: '' }] }))).toBe(false)
	})

	it('counts a row that only picked a store as empty', () => {
		// Choosing a store without typing anything is not content.
		expect(draftHasContent(draft({ rows: [{ text: '', store: 'costco' }] }))).toBe(false)
	})
})
