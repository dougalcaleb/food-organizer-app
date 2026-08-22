/*
The rule for turning an editor draft into something worth saving, kept out of
the component so it can be tested directly.

Two decisions live here:

  - A draft with nothing typed anywhere is discarded. Saving a wholly blank
    meal just creates a card you have to go and delete.
  - A draft with content but no title is kept under a placeholder name, because
    throwing away ingredients someone typed is far worse than an untitled row
    they can rename.
*/
import { parseIngredient } from './parseIngredient'
import type { Ingredient, Store } from '@/types'

export const UNTITLED = 'Untitled idea'

export interface DraftRow {
	text: string
	store?: Store
}

export interface MealDraft {
	name: string
	notes: string
	tags: string[]
	rows: DraftRow[]
}

export interface MealPayload {
	name: string
	notes: string
	tags: string[]
	ingredients: Ingredient[]
}

/**
 * Parse the draft's ingredient rows, dropping any that are effectively blank.
 * Absent fields are omitted entirely rather than stored as undefined, so a
 * bare ingredient round-trips as `{ name }`.
 */
export function draftIngredients(rows: readonly DraftRow[]): Ingredient[] {
	return rows.flatMap((row) => {
		const parsed = parseIngredient(row.text)
		if (!parsed.name) return []

		return [
			{
				name: parsed.name,
				...(parsed.amount !== undefined ? { amount: parsed.amount } : {}),
				...(parsed.unit ? { unit: parsed.unit } : {}),
				...(row.store ? { store: row.store } : {}),
			},
		]
	})
}

/** Whether anything at all was typed. */
export function draftHasContent(draft: MealDraft): boolean {
	return (
		draft.name.trim() !== '' ||
		draft.notes.trim() !== '' ||
		draft.tags.length > 0 ||
		draftIngredients(draft.rows).length > 0
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
		ingredients: draftIngredients(draft.rows),
	}
}
