/*
Turns one typed line into an Ingredient.

The editor's whole premise is that you type an ingredient the way you would say
it — "2 cans coconut milk" — rather than filling in three fields. So this has to
be forgiving in both directions: it should catch the obvious shapes, and when it
is not sure it must fall back to treating the whole line as a name rather than
inventing a quantity. A wrong guess is worse than no guess, because the user
sees the result inline and has to undo it.

Deliberately NOT handled: ranges ("2-3 peppers"), parenthetical notes, and
trailing prep instructions ("onion, diced"). Those all end up in the name, which
is the correct fallback — the name is free text and nothing downstream parses it.
*/
import type { Ingredient } from '@/types'

/**
 * Units we are willing to recognise. A closed list on purpose: matching any
 * word after a number would turn "3 bell pepper" into 3 × "bell" of "pepper".
 * Anything unrecognised stays part of the name, which reads correctly anyway.
 */
const UNITS = [
	// weight
	'lb',
	'lbs',
	'pound',
	'pounds',
	'oz',
	'ounce',
	'ounces',
	'g',
	'gram',
	'grams',
	'kg',
	// volume
	'cup',
	'cups',
	'tbsp',
	'tablespoon',
	'tablespoons',
	'tsp',
	'teaspoon',
	'teaspoons',
	'ml',
	'l',
	'liter',
	'liters',
	'gal',
	'gallon',
	'gallons',
	'pint',
	'pints',
	'quart',
	'quarts',
	// packaging
	'can',
	'cans',
	'jar',
	'jars',
	'bag',
	'bags',
	'box',
	'boxes',
	'bottle',
	'bottles',
	'pack',
	'packs',
	'package',
	'packages',
	'tub',
	'tubs',
	'container',
	'containers',
	'block',
	'blocks',
	'stick',
	'sticks',
	'loaf',
	'loaves',
	// produce and other countables
	'bunch',
	'bunches',
	'head',
	'heads',
	'clove',
	'cloves',
	'sprig',
	'sprigs',
	'slice',
	'slices',
	'wedge',
	'wedges',
	'knob',
	'knobs',
	'dozen',
	'handful',
	'pinch',
	'dash',
]

const UNIT_SET = new Set(UNITS)

/**
 * Leading quantity: "2", "1.5", "1/2", or a mixed number like "2 1/2".
 * Anchored, so a number appearing later in the line is left inside the name.
 */
const QUANTITY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*/

function parseAmount(raw: string): number | undefined {
	const text = raw.trim()

	// Mixed number: "2 1/2"
	const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text)
	if (mixed) {
		const [, whole, numerator, denominator] = mixed
		if (Number(denominator) === 0) return undefined
		return Number(whole) + Number(numerator) / Number(denominator)
	}

	// Plain fraction: "1/2"
	const fraction = /^(\d+)\/(\d+)$/.exec(text)
	if (fraction) {
		const [, numerator, denominator] = fraction
		if (Number(denominator) === 0) return undefined
		return Number(numerator) / Number(denominator)
	}

	const value = Number(text)
	return Number.isFinite(value) ? value : undefined
}

export interface ParsedIngredient extends Ingredient {
	/** True when a quantity or unit was recognised, so the UI can show the split. */
	parsed: boolean
}

/**
 * Parse one line into an ingredient. Never throws and never returns an empty
 * name for non-empty input — the whole line is the fallback.
 */
export function parseIngredient(input: string): ParsedIngredient {
	const line = input.trim().replace(/\s+/g, ' ')
	if (!line) return { name: '', parsed: false }

	const quantityMatch = QUANTITY.exec(line)

	if (!quantityMatch) {
		return { name: line, parsed: false }
	}

	const amount = parseAmount(quantityMatch[1])
	let rest = line.slice(quantityMatch[0].length).trim()

	// A number with nothing after it is a name, not a quantity — "7up" would
	// already have failed the anchor, but "2" alone should not become a
	// nameless ingredient.
	if (!rest) return { name: line, parsed: false }
	if (amount === undefined) return { name: line, parsed: false }

	let unit: string | undefined
	const [firstWord, ...remaining] = rest.split(' ')

	if (UNIT_SET.has(firstWord.toLowerCase())) {
		unit = firstWord.toLowerCase()
		rest = remaining.join(' ').trim()

		// "2 cans of coconut milk"
		if (rest.toLowerCase().startsWith('of ')) {
			rest = rest.slice(3).trim()
		}
	}

	// A quantity and a unit but no name ("2 cans") is not useful — treat the
	// whole thing as a name so nothing is lost.
	if (!rest) return { name: line, parsed: false }

	return { name: rest, amount, unit, parsed: true }
}

/** Render an ingredient back to the single line that would parse to it. */
export function formatIngredient(ingredient: Ingredient): string {
	return [ingredient.amount, ingredient.unit, ingredient.name]
		.filter((part) => part !== undefined && part !== '')
		.join(' ')
}
