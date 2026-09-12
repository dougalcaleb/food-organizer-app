import { describe, expect, it } from 'vitest'
import { draftHasContent, draftIngredients, draftToPayload, UNTITLED } from './mealDraft'
import type { DraftItem, MealDraft } from './mealDraft'
import type { Store } from '@/types'

function ing(text: string, store?: Store): DraftItem {
	return { kind: 'ingredient', text, ...(store ? { store } : {}) }
}

function part(name: string): DraftItem {
	return { kind: 'part', name }
}

function draft(overrides: Partial<MealDraft> = {}): MealDraft {
	return { name: '', notes: '', tags: [], items: [ing('')], ...overrides }
}

describe('draftToPayload — what counts as worth saving', () => {
	it('discards a wholly blank draft', () => {
		expect(draftToPayload(draft())).toBeNull()
	})

	it('discards a draft of nothing but whitespace', () => {
		expect(draftToPayload(draft({ name: '   ', notes: '  ', items: [ing(' ')] }))).toBeNull()
	})

	it('saves a draft with only a name', () => {
		expect(draftToPayload(draft({ name: 'that thai place thing' }))).toMatchObject({
			name: 'that thai place thing',
			ingredients: [],
			tags: [],
		})
	})

	it('keeps an untitled draft that has ingredients', () => {
		const payload = draftToPayload(draft({ items: [ing('2 cans coconut milk')] }))

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

	it('discards a draft of nothing but part headings', () => {
		// A heading with nothing under it is not a recipe, and saving one would
		// leave a card holding no ingredients and no name.
		expect(draftToPayload(draft({ items: [part('Sauce'), part('Base')] }))).toBeNull()
	})
})

describe('draftIngredients', () => {
	it('drops blank rows without dropping real ones', () => {
		const items = [ing('olive oil'), ing('   '), ing('2 cans coconut milk')]
		expect(draftIngredients(items).map((i) => i.name)).toEqual(['olive oil', 'coconut milk'])
	})

	it('omits absent fields entirely rather than storing undefined', () => {
		// Matters for persistence: `{ name, amount: undefined }` does not survive
		// a JSON round trip the same way `{ name }` does.
		expect(draftIngredients([ing('olive oil')])).toEqual([{ name: 'olive oil' }])
	})

	it('carries the row store through', () => {
		expect(draftIngredients([ing('olive oil', 'costco')])).toEqual([
			{ name: 'olive oil', store: 'costco' },
		])
	})

	it('leaves the store off when none was picked', () => {
		expect(draftIngredients([ing('olive oil')])[0].store).toBeUndefined()
	})
})

describe('draftIngredients — the part a row sits in', () => {
	it('stamps every row under a heading with it', () => {
		const items = [part('Sauce'), ing('fish sauce'), ing('lime'), part('Base'), ing('rice')]

		expect(draftIngredients(items)).toEqual([
			{ name: 'fish sauce', part: 'Sauce' },
			{ name: 'lime', part: 'Sauce' },
			{ name: 'rice', part: 'Base' },
		])
	})

	it('leaves rows above the first heading in no part at all', () => {
		// A meal is a flat list until someone says otherwise, and it stays one for
		// the rows nobody has put anywhere.
		const items = [ing('olive oil'), part('Sauce'), ing('lime')]

		expect(draftIngredients(items).map((i) => i.part)).toEqual([undefined, 'Sauce'])
	})

	it('trims the heading, so the same part is one part', () => {
		expect(draftIngredients([part('  Sauce  '), ing('lime')])[0].part).toBe('Sauce')
	})

	it('ends the part above it when a heading is left blank', () => {
		// Which is also how a part is dissolved without deleting anything in it:
		// clear its name, or remove the heading row.
		const items = [part('Sauce'), ing('lime'), part('  '), ing('rice')]

		expect(draftIngredients(items).map((i) => i.part)).toEqual(['Sauce', undefined])
	})

	it('drops a heading with nothing under it', () => {
		// Nothing records an empty part, so nothing can resurrect one: the parts a
		// meal has are exactly the parts its ingredients name.
		const items = [part('Sauce'), part('Base'), ing('rice')]

		expect(draftIngredients(items)).toEqual([{ name: 'rice', part: 'Base' }])
	})

	it('follows the row when it is moved under another heading', () => {
		/*
		The point of keeping parts as runs of one flat list: membership is read off
		the order, so the drag that reorders rows is the whole implementation of
		moving an ingredient between parts. Nothing else has to be updated, and
		nothing can disagree with the order on screen.
		*/
		const items = [part('Sauce'), ing('lime'), part('Base'), ing('rice')]
		const moved = [items[0], items[2], items[1], items[3]]

		expect(draftIngredients(moved).map((i) => [i.name, i.part])).toEqual([
			['lime', 'Base'],
			['rice', 'Base'],
		])
	})
})

describe('draftHasContent', () => {
	it('ignores rows that parse to nothing', () => {
		expect(draftHasContent(draft({ items: [ing('  '), ing('')] }))).toBe(false)
	})

	it('counts a row that only picked a store as empty', () => {
		// Choosing a store without typing anything is not content.
		expect(draftHasContent(draft({ items: [ing('', 'costco')] }))).toBe(false)
	})

	it('counts a part heading with no ingredients as empty', () => {
		expect(draftHasContent(draft({ items: [part('Sauce')] }))).toBe(false)
	})
})
