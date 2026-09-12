/*
The rule for turning an editor draft into something worth saving, kept out of
the component so it can be tested directly.

Three decisions live here:

  - A draft with nothing typed anywhere is discarded. Saving a wholly blank
    meal just creates a card you have to go and delete.
  - A draft with content but no title is kept under a placeholder name, because
    throwing away ingredients someone typed is far worse than an untitled row
    they can rename.
  - A part heading applies to every row under it until the next one, so an
    ingredient's part is decided by WHERE IT SITS rather than by a field of its
    own. That is what makes moving a row between parts the same gesture as
    moving it up one slot, and it is why the editor's list is one flat list of
    rows with headings in it. A heading with nothing under it is dropped, and a
    heading left blank simply ends the part above it.
*/
import { parseIngredient } from './parseIngredient'
import type { Ingredient, Store } from '@/types'

export const UNTITLED = 'Untitled idea'

/** An ingredient row in the editor. */
export interface DraftIngredient {
	kind: 'ingredient'
	text: string
	store?: Store
}

/** A part heading in the editor — "Sauce", and everything below it. */
export interface DraftPart {
	kind: 'part'
	name: string
}

export type DraftItem = DraftIngredient | DraftPart

export interface MealDraft {
	name: string
	notes: string
	tags: string[]
	items: DraftItem[]
}

export interface MealPayload {
	name: string
	notes: string
	tags: string[]
	ingredients: Ingredient[]
}

/**
 * Parse the draft's ingredient rows, dropping any that are effectively blank
 * and stamping each with the part heading it sits under.
 *
 * Absent fields are omitted entirely rather than stored as undefined, so a
 * bare ingredient round-trips as `{ name }`.
 */
export function draftIngredients(items: readonly DraftItem[]): Ingredient[] {
	let part: string | undefined

	return items.flatMap((item) => {
		if (item.kind === 'part') {
			// A blank heading is not a part: it ends the one above it and leaves
			// what follows ungrouped, which is also how a part is dissolved without
			// deleting the rows in it.
			part = item.name.trim() || undefined
			return []
		}

		const parsed = parseIngredient(item.text)
		if (!parsed.name) return []

		return [
			{
				name: parsed.name,
				...(parsed.amount !== undefined ? { amount: parsed.amount } : {}),
				...(parsed.unit ? { unit: parsed.unit } : {}),
				...(item.store ? { store: item.store } : {}),
				...(part ? { part } : {}),
			},
		]
	})
}

/**
 * Whether anything at all was typed.
 *
 * A part heading is deliberately not content: a heading with no ingredients
 * under it is dropped on save, so counting one would save a meal that ends up
 * holding nothing.
 */
export function draftHasContent(draft: MealDraft): boolean {
	return (
		draft.name.trim() !== '' ||
		draft.notes.trim() !== '' ||
		draft.tags.length > 0 ||
		draftIngredients(draft.items).length > 0
	)
}

/**
 * The payload to save, or `null` when the draft should be discarded.
 */
export function draftToPayload(draft: MealDraft): MealPayload | null {
	if (!draftHasContent(draft)) return null

	return {
		name: draft.name.trim() || UNTITLED,
		notes: draft.notes.trim(),
		tags: draft.tags,
		ingredients: draftIngredients(draft.items),
	}
}
