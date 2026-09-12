/*
How a meal's flat ingredient array is read back — the two things that array is
asked for that are not simply "list it in order".

PARTS. An ingredient can say which part of the recipe it is for ("Sauce",
"Marinade"). That is a plain string on the ingredient, exactly like a tag on a
meal, and not an id into a table of parts: there is nothing about a part beyond
its name, and a name cannot be orphaned by an edit somewhere else.

The array stays flat and stays in the order it was typed, so parts are
CONTIGUOUS RUNS in it rather than a nesting. That is what keeps the editor's
drag arithmetic working on one list of rows, and it is why moving a row into
another part is the same gesture as moving it up one slot.

Colour is not stored. A part is given a colour slot by where its name first
appears, so the same part is the same colour in the editor and in the detail
sheet, and two parts of the same name never disagree.

MERGING. Two parts of one recipe routinely want the same thing — oil in the
marinade and oil in the pan. The answer to that is to write it in both, which
is why it needs no model of its own: everything that treats a meal's
ingredients as things to BUY merges them by the same normalized name the
shopping list merges on, so the shopping list, the ingredient count and the
pull picker all agree that it is one thing.
*/
import { itemKey } from './shoppingList'
import { sumQuantities } from './quantities'
import type { Ingredient } from '@/types'

/** How many part colours exist before they start again. */
export const PART_COLORS = 5

/*
Referenced rather than interpolated so the class names survive a grep, and so
this file is the one place that knows how many there are.
*/
const PART_CLASSES = ['part-1', 'part-2', 'part-3', 'part-4', 'part-5'] as const

/** The colour class for a slot from `partColorSlots`. */
export function partClass(slot: number): string {
	return PART_CLASSES[(slot - 1) % PART_COLORS]
}

/**
 * Assign each part name a colour slot, in order of first appearance, cycling
 * once the palette runs out.
 *
 * Keyed by name rather than by position so a part that appears in two separate
 * runs — which the editor allows, since membership follows position — is drawn
 * the same both times.
 */
export function partColorSlots(names: readonly (string | undefined)[]): Map<string, number> {
	const slots = new Map<string, number>()

	for (const name of names) {
		if (!name) continue
		if (!slots.has(name)) slots.set(name, (slots.size % PART_COLORS) + 1)
	}

	return slots
}

/** A contiguous run of ingredients belonging to the same part, or to none. */
export interface PartGroup {
	/** Absent for ingredients in no part at all, which is the default. */
	part?: string
	/** Colour slot, absent alongside `part`. */
	slot?: number
	ingredients: Ingredient[]
}

/**
 * Split a meal's ingredients into the runs it is written in.
 *
 * A meal with no parts yields exactly one group with no name, so a caller can
 * render groups unconditionally and get today's flat list for free.
 */
export function partGroups(ingredients: readonly Ingredient[]): PartGroup[] {
	const slots = partColorSlots(ingredients.map((ing) => ing.part))
	const groups: PartGroup[] = []

	for (const ing of ingredients) {
		const last = groups[groups.length - 1]

		if (!last || last.part !== ing.part) {
			groups.push({
				...(ing.part ? { part: ing.part, slot: slots.get(ing.part) } : {}),
				ingredients: [ing],
			})
			continue
		}

		last.ingredients.push(ing)
	}

	return groups
}

/** One thing to buy for a meal, however many of its parts asked for it. */
export interface MergedIngredient {
	/** The same key the shopping list merges on, and what a pull records. */
	key: string
	name: string
	/** Summed across every part that wants it. */
	qty: string
	/** The parts it appears in, in order. Empty when it is in no part. */
	parts: string[]
}

/**
 * Merge a meal's ingredients by normalized name.
 *
 * This is the shopping view of one meal: how many things it needs, and how much
 * of each. Anything counting or ticking off a meal's ingredients has to go
 * through here, or a shared ingredient counts twice and a meal whose
 * ingredients are all on the list never reads as complete.
 */
export function mergeIngredients(ingredients: readonly Ingredient[]): MergedIngredient[] {
	const merged = new Map<
		string,
		{ key: string; name: string; parts: string[]; amounts: { amount?: number; unit?: string }[] }
	>()

	for (const ing of ingredients) {
		const key = itemKey(ing.name)
		if (!key) continue

		let entry = merged.get(key)

		if (!entry) {
			// First spelling wins, as it does on the shopping list.
			entry = { key, name: ing.name.trim(), parts: [], amounts: [] }
			merged.set(key, entry)
		}

		entry.amounts.push({ amount: ing.amount, unit: ing.unit })
		if (ing.part && !entry.parts.includes(ing.part)) entry.parts.push(ing.part)
	}

	return [...merged.values()].map(({ key, name, parts, amounts }) => ({
		key,
		name,
		qty: sumQuantities(amounts),
		parts,
	}))
}
