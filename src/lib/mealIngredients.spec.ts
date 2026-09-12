import { describe, expect, it } from 'vitest'
import { mergeIngredients, partClass, partColorSlots, partGroups } from './mealIngredients'
import type { Ingredient } from '@/types'

function ing(name: string, part?: string, extra: Partial<Ingredient> = {}): Ingredient {
	return { name, ...(part ? { part } : {}), ...extra }
}

describe('partGroups', () => {
	it('gives a meal with no parts one unnamed group', () => {
		// Which is what lets a caller render groups unconditionally and get the
		// flat list every meal had before parts existed.
		const groups = partGroups([ing('onion'), ing('garlic')])

		expect(groups).toHaveLength(1)
		expect(groups[0].part).toBeUndefined()
		expect(groups[0].ingredients.map((i) => i.name)).toEqual(['onion', 'garlic'])
	})

	it('splits the list into the runs it is written in', () => {
		const groups = partGroups([
			ing('chicken thighs', 'Marinade'),
			ing('yogurt', 'Marinade'),
			ing('rice', 'Base'),
		])

		expect(groups.map((g) => [g.part, g.ingredients.length])).toEqual([
			['Marinade', 2],
			['Base', 1],
		])
	})

	it('keeps ingredients in no part in their own group, wherever they sit', () => {
		const groups = partGroups([ing('olive oil'), ing('lime', 'Sauce'), ing('salt')])

		expect(groups.map((g) => g.part)).toEqual([undefined, 'Sauce', undefined])
	})

	it('never reorders anything', () => {
		// The order the ingredients were typed in is how the meal is written down,
		// which for a recipe is how it is cooked. Grouping reads it; it never sorts.
		const list = [ing('c', 'B'), ing('a', 'A'), ing('b', 'A')]

		expect(partGroups(list).flatMap((g) => g.ingredients.map((i) => i.name))).toEqual([
			'c',
			'a',
			'b',
		])
	})

	it('gives two runs of the same part the same colour', () => {
		const groups = partGroups([ing('a', 'Sauce'), ing('b', 'Base'), ing('c', 'Sauce')])

		expect(groups[0].slot).toBe(groups[2].slot)
		expect(groups[1].slot).not.toBe(groups[0].slot)
	})
})

describe('part colours', () => {
	it('numbers parts by first appearance', () => {
		expect([...partColorSlots(['Sauce', 'Base', 'Sauce'])]).toEqual([
			['Sauce', 1],
			['Base', 2],
		])
	})

	it('ignores the rows that name no part', () => {
		expect([...partColorSlots([undefined, 'Sauce', undefined])]).toEqual([['Sauce', 1]])
	})

	it('starts the palette again rather than running out', () => {
		const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
		const slots = partColorSlots(names)

		expect(names.map((n) => slots.get(n))).toEqual([1, 2, 3, 4, 5, 1, 2])
	})

	it('names a class for every slot', () => {
		expect([1, 2, 3, 4, 5].map(partClass)).toEqual([
			'part-1',
			'part-2',
			'part-3',
			'part-4',
			'part-5',
		])
	})
})

describe('mergeIngredients — one thing to buy, however many parts want it', () => {
	/*
	Writing a shared ingredient into both parts is the answer to "what about the
	oil that is in the marinade AND the pan", so everything that treats a meal's
	ingredients as things to buy has to agree that it is one thing. Get this wrong
	and a meal with all of its ingredients on the list never reads as complete.
	*/
	it('merges by normalized name, summing the amounts', () => {
		const merged = mergeIngredients([
			ing('olive oil', 'Marinade', { amount: 2, unit: 'tbsp' }),
			ing('Olive Oil', 'Pan', { amount: 1, unit: 'tbsp' }),
		])

		expect(merged).toEqual([
			{ key: 'olive oil', name: 'olive oil', qty: '3 tbsp', parts: ['Marinade', 'Pan'] },
		])
	})

	it('keys on the same key the shopping list and a pull use', () => {
		expect(mergeIngredients([ing('  Bell Pepper ')])[0].key).toBe('bell pepper')
	})

	it('leaves separate things separate', () => {
		expect(mergeIngredients([ing('chicken thigh'), ing('chicken thighs')])).toHaveLength(2)
	})

	it('keeps the order of first appearance', () => {
		expect(mergeIngredients([ing('b'), ing('a'), ing('b')]).map((i) => i.name)).toEqual(['b', 'a'])
	})

	it('reports no parts for an ungrouped ingredient', () => {
		expect(mergeIngredients([ing('salt')])[0].parts).toEqual([])
	})
})
