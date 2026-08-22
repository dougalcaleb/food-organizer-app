import { describe, expect, it } from 'vitest'
import type { ExtraItem, Ingredient, Meal } from '@/types'
import { buildItems, groupItems } from './shoppingList'

function meal(id: string, name: string, ingredients: Ingredient[]): Meal {
	return {
		id,
		name,
		tags: [],
		notes: '',
		lastMadeAt: null,
		ingredients,
		createdAt: 0,
		updatedAt: 0,
		archived: false,
	}
}

function ing(
	name: string,
	amount: number,
	unit: string,
	store: Ingredient['store'] = 'costco',
): Ingredient {
	return { name, amount, unit, store }
}

function extra(
	id: string,
	name: string,
	qty: string,
	store: ExtraItem['store'],
	overrides: Partial<ExtraItem> = {},
): ExtraItem {
	return { id, name, qty, store, kind: 'oneoff', active: true, createdAt: 0, ...overrides }
}

const find = (items: ReturnType<typeof buildItems>, name: string) =>
	items.find((i) => i.name.toLowerCase() === name)!

describe('buildItems — quantity merging', () => {
	it('sums amounts sharing a unit', () => {
		const meals = [
			meal('a', 'Curry', [ing('coconut milk', 2, 'cans')]),
			meal('b', 'Chili', [ing('coconut milk', 1, 'cans')]),
		]

		const items = buildItems(meals, ['a', 'b'], [])
		expect(find(items, 'coconut milk').qty).toBe('3 cans')
	})

	it('keeps mismatched units separate, joined with " + "', () => {
		const meals = [
			meal('a', 'Ziti', [ing('ground beef', 1, 'lb')]),
			meal('b', 'Chili', [ing('ground beef', 2, '')]),
		]

		const items = buildItems(meals, ['a', 'b'], [])
		expect(find(items, 'ground beef').qty).toBe('1 lb + 2')
	})

	it('merges case- and whitespace-insensitively, keeping the first spelling', () => {
		const meals = [
			meal('a', 'Curry', [ing('Bell Pepper', 2, '')]),
			meal('b', 'Sausage', [ing('  bell pepper ', 3, '')]),
		]

		const items = buildItems(meals, ['a', 'b'], [])
		expect(items).toHaveLength(1)
		expect(items[0].name).toBe('Bell Pepper')
		expect(items[0].qty).toBe('5')
	})

	it('does not leave a floating-point tail on fractional amounts', () => {
		const meals = [
			meal('a', 'Curry', [ing('chicken thighs', 1.5, 'lb')]),
			meal('b', 'Shawarma', [ing('chicken thighs', 1.2, 'lb')]),
		]

		const items = buildItems(meals, ['a', 'b'], [])
		expect(find(items, 'chicken thighs').qty).toBe('2.7 lb')
	})
})

describe('buildItems — store resolution', () => {
	it('resolves to `either` when any contributor says either', () => {
		const meals = [
			meal('a', 'Oats', [ing('milk', 1, 'gal', 'either')]),
			meal('b', 'Burrito', [ing('milk', 1, 'gal', 'costco')]),
		]

		expect(find(buildItems(meals, ['a', 'b'], []), 'milk').store).toBe('either')
	})

	it('resolves a costco/walmart disagreement to `either`', () => {
		const meals = [
			meal('a', 'Ziti', [ing('ground beef', 1, 'lb', 'costco')]),
			meal('b', 'Chili', [ing('ground beef', 2, 'lb', 'walmart')]),
		]

		expect(find(buildItems(meals, ['a', 'b'], []), 'ground beef').store).toBe('either')
	})

	it('prefers a real store over `wherever`', () => {
		const meals = [
			meal('a', 'Curry', [ing('cumin', 1, 'jar', 'wherever')]),
			meal('b', 'Shawarma', [ing('cumin', 1, 'jar', 'walmart')]),
		]

		expect(find(buildItems(meals, ['a', 'b'], []), 'cumin').store).toBe('walmart')
	})

	it('keeps `wherever` when nothing else claims the item', () => {
		const meals = [meal('a', 'Curry', [ing('thai basil', 1, 'bunch', 'wherever')])]
		expect(find(buildItems(meals, ['a'], []), 'thai basil').store).toBe('wherever')
	})
})

describe('buildItems — plan and extras', () => {
	it('ignores meals that are not in the plan', () => {
		const meals = [
			meal('a', 'Curry', [ing('rice', 1, 'bag')]),
			meal('b', 'Chili', [ing('beans', 3, 'cans')]),
		]

		const items = buildItems(meals, ['a'], [])
		expect(items.map((i) => i.name)).toEqual(['rice'])
	})

	it('tolerates a plan referencing a deleted meal', () => {
		const meals = [meal('a', 'Curry', [ing('rice', 1, 'bag')])]
		expect(() => buildItems(meals, ['a', 'ghost'], [])).not.toThrow()
		expect(buildItems(meals, ['a', 'ghost'], [])).toHaveLength(1)
	})

	it('appends extras with no meal association and sorts everything by name', () => {
		const meals = [meal('a', 'Curry', [ing('rice', 1, 'bag')])]
		const items = buildItems(meals, ['a'], [extra('e1', 'paper towels', '1 pack', 'costco')])

		expect(items.map((i) => i.name)).toEqual(['paper towels', 'rice'])
		expect(find(items, 'paper towels').isExtra).toBe(true)
		expect(find(items, 'paper towels').meals).toEqual([])
	})

	it('combines an ingredient a single meal lists twice', () => {
		const meals = [meal('a', 'Curry', [ing('olive oil', 1, 'tbsp'), ing('olive oil', 2, 'tbsp')])]
		const items = buildItems(meals, ['a'], [])

		expect(items).toHaveLength(1)
		expect(items[0].qty).toBe('3 tbsp')
		expect(items[0].perMeal.a).toBe('3 tbsp')
	})
})

describe('groupItems — by store', () => {
	const meals = [
		meal('a', 'Curry', [
			ing('coconut milk', 2, 'cans', 'costco'),
			ing('bell pepper', 2, '', 'walmart'),
			ing('thai basil', 1, 'bunch', 'wherever'),
			ing('sandwich bread', 1, 'loaf', 'either'),
		]),
	]
	const groups = groupItems(buildItems(meals, ['a'], []), 'store', meals, ['a'])
	const names = (title: string) => groups.find((g) => g.title === title)!.items.map((i) => i.name)

	it('orders groups Costco, Walmart, Wherever', () => {
		expect(groups.map((g) => g.title)).toEqual(['Costco', 'Walmart', 'Wherever'])
	})

	it('puts an `either` item in BOTH Costco and Walmart, but not Wherever', () => {
		expect(names('Costco')).toContain('sandwich bread')
		expect(names('Walmart')).toContain('sandwich bread')
		expect(names('Wherever')).not.toContain('sandwich bread')
	})

	it('appends "either store" to the meta line of an `either` item', () => {
		const bread = groups
			.find((g) => g.title === 'Costco')!
			.items.find((i) => i.name === 'sandwich bread')!

		expect(bread.meta).toBe('Curry · either store')
	})

	it('omits empty groups', () => {
		const only = [meal('z', 'Rice', [ing('rice', 1, 'bag', 'costco')])]
		expect(groupItems(buildItems(only, ['z'], []), 'store', only, ['z'])).toHaveLength(1)
	})

	it('labels extras as one-off', () => {
		const items = buildItems([], [], [extra('e1', 'paper towels', '1 pack', 'costco')])
		const g = groupItems(items, 'store', [], [])
		expect(g[0].items[0].meta).toBe('one-off')
	})
})

describe('groupItems — by meal', () => {
	const meals = [
		meal('a', 'Curry', [ing('bell pepper', 2, '', 'walmart')]),
		meal('b', 'Sheet-pan sausage and peppers', [ing('bell pepper', 3, '', 'walmart')]),
	]
	const items = buildItems(meals, ['a', 'b'], [extra('e1', 'coffee', '2 bags', 'either')])
	const groups = groupItems(items, 'meal', meals, ['a', 'b'])

	it('makes one group per planned meal, in plan order, then One-offs', () => {
		expect(groups.map((g) => g.title)).toEqual([
			'Curry',
			'Sheet-pan sausage and peppers',
			'One-offs',
		])
	})

	it('shows the amount that meal alone needs, not the aggregate', () => {
		expect(groups[0].items[0].qty).toBe('2')
		expect(groups[1].items[0].qty).toBe('3')
		// The aggregate still exists on the merged item.
		expect(items[0].qty).toBe('5')
	})

	it('names the other meals needing the item, with the running total', () => {
		expect(groups[0].items[0].meta).toBe(
			'Walmart · also for Sheet-pan sausage and peppers (5 total)',
		)
	})

	it('omits the "also for" clause when only one meal needs the item', () => {
		const solo = [meal('a', 'Curry', [ing('rice', 1, 'bag', 'costco')])]
		const g = groupItems(buildItems(solo, ['a'], []), 'meal', solo, ['a'])
		expect(g[0].items[0].meta).toBe('Costco')
	})
})

describe('groupItems — all', () => {
	it('uses a single Everything group with store and meals in the meta', () => {
		const meals = [meal('a', 'Curry', [ing('rice', 1, 'bag', 'costco')])]
		const groups = groupItems(buildItems(meals, ['a'], []), 'all', meals, ['a'])

		expect(groups).toHaveLength(1)
		expect(groups[0].title).toBe('Everything')
		expect(groups[0].items[0].meta).toBe('Costco · Curry')
	})

	it('marks extras as one-off with their store', () => {
		const items = buildItems([], [], [extra('e1', 'coffee', '2 bags', 'either')])
		const groups = groupItems(items, 'all', [], [])
		expect(groups[0].items[0].meta).toBe('one-off · Either')
	})

	it('returns no groups when there is nothing to buy', () => {
		expect(groupItems([], 'all', [], [])).toEqual([])
	})
})
