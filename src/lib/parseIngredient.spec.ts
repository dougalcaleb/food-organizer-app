import { describe, expect, it } from 'vitest'
import { formatIngredient, parseIngredient } from './parseIngredient'

/** Compact assertion helper: name / amount / unit. */
function parsed(input: string) {
	const { name, amount, unit } = parseIngredient(input)
	return { name, amount, unit }
}

describe('parseIngredient — the shapes people actually type', () => {
	it('splits amount, unit and name', () => {
		expect(parsed('2 cans coconut milk')).toEqual({
			name: 'coconut milk',
			amount: 2,
			unit: 'cans',
		})
	})

	it('handles decimals', () => {
		expect(parsed('1.5 lb chicken thighs')).toEqual({
			name: 'chicken thighs',
			amount: 1.5,
			unit: 'lb',
		})
	})

	it('takes a bare name', () => {
		expect(parsed('olive oil')).toEqual({ name: 'olive oil', amount: undefined, unit: undefined })
	})

	it('takes a count with no unit', () => {
		expect(parsed('3 bell pepper')).toEqual({
			name: 'bell pepper',
			amount: 3,
			unit: undefined,
		})
	})

	it('understands fractions', () => {
		expect(parsed('1/2 cup rice')).toEqual({ name: 'rice', amount: 0.5, unit: 'c' })
	})

	it('understands mixed numbers', () => {
		expect(parsed('2 1/2 lb beef')).toEqual({ name: 'beef', amount: 2.5, unit: 'lb' })
	})

	it('drops a connecting "of"', () => {
		expect(parsed('2 cans of coconut milk')).toEqual({
			name: 'coconut milk',
			amount: 2,
			unit: 'cans',
		})
	})

	it('normalises unit case but leaves the name alone', () => {
		expect(parsed('2 CANS Coconut Milk')).toEqual({
			name: 'Coconut Milk',
			amount: 2,
			unit: 'cans',
		})
	})

	it('keeps "t" and "T" distinct as teaspoon and tablespoon', () => {
		expect(parsed('1 t vanilla')).toEqual({ name: 'vanilla', amount: 1, unit: 't' })
		expect(parsed('1 T olive oil')).toEqual({ name: 'olive oil', amount: 1, unit: 'T' })
	})

	it('recognises "c" as cups', () => {
		expect(parsed('2 c flour')).toEqual({ name: 'flour', amount: 2, unit: 'c' })
	})

	it('collapses every spelling of a weight or volume unit to one abbreviation', () => {
		expect(parsed('2 cup rice').unit).toBe('c')
		expect(parsed('2 cups rice').unit).toBe('c')
		expect(parsed('2 tsp vanilla').unit).toBe('t')
		expect(parsed('2 teaspoon vanilla').unit).toBe('t')
		expect(parsed('2 teaspoons vanilla').unit).toBe('t')
		expect(parsed('2 tbsp olive oil').unit).toBe('T')
		expect(parsed('2 tablespoon olive oil').unit).toBe('T')
		expect(parsed('2 tablespoons olive oil').unit).toBe('T')
		expect(parsed('2 lbs chicken').unit).toBe('lb')
		expect(parsed('2 pound chicken').unit).toBe('lb')
		expect(parsed('2 pounds chicken').unit).toBe('lb')
		expect(parsed('2 ounce butter').unit).toBe('oz')
		expect(parsed('2 ounces butter').unit).toBe('oz')
		expect(parsed('2 gram sugar').unit).toBe('g')
		expect(parsed('2 grams sugar').unit).toBe('g')
		expect(parsed('2 kilogram flour').unit).toBe('kg')
		expect(parsed('2 kilograms flour').unit).toBe('kg')
		expect(parsed('2 milliliter stock').unit).toBe('ml')
		expect(parsed('2 milliliters stock').unit).toBe('ml')
		expect(parsed('2 liter stock').unit).toBe('l')
		expect(parsed('2 liters stock').unit).toBe('l')
		expect(parsed('2 gallon milk').unit).toBe('gal')
		expect(parsed('2 gallons milk').unit).toBe('gal')
		expect(parsed('2 pint cream').unit).toBe('pt')
		expect(parsed('2 pints cream').unit).toBe('pt')
		expect(parsed('2 quart broth').unit).toBe('qt')
		expect(parsed('2 quarts broth').unit).toBe('qt')
	})

	it('does not collapse packaging units, since their plural agrees with the amount', () => {
		expect(parsed('1 can beans').unit).toBe('can')
		expect(parsed('2 cans beans').unit).toBe('cans')
	})

	it('collapses messy whitespace', () => {
		expect(parsed('  2   cans    coconut  milk ')).toEqual({
			name: 'coconut milk',
			amount: 2,
			unit: 'cans',
		})
	})
})

describe('parseIngredient — refusing to guess', () => {
	it('does not treat an ordinary word as a unit', () => {
		// "bell" is not a unit, so it stays in the name.
		expect(parsed('3 bell pepper').unit).toBeUndefined()
	})

	it('leaves a number appearing mid-line inside the name', () => {
		expect(parsed('san marzano tomatoes 400g')).toEqual({
			name: 'san marzano tomatoes 400g',
			amount: undefined,
			unit: undefined,
		})
	})

	it('keeps a quantity with no name as a name', () => {
		expect(parsed('2 cans')).toEqual({ name: '2 cans', amount: undefined, unit: undefined })
		expect(parsed('12')).toEqual({ name: '12', amount: undefined, unit: undefined })
	})

	it('does not choke on a zero denominator', () => {
		expect(parsed('1/0 cup rice').name).toBe('1/0 cup rice')
	})

	it('returns an empty name for empty input', () => {
		expect(parseIngredient('   ').name).toBe('')
		expect(parseIngredient('').parsed).toBe(false)
	})

	it('reports whether it actually split anything', () => {
		expect(parseIngredient('2 cans coconut milk').parsed).toBe(true)
		expect(parseIngredient('3 bell pepper').parsed).toBe(true)
		expect(parseIngredient('olive oil').parsed).toBe(false)
	})

	it('never invents a quantity for prose', () => {
		for (const line of ['a dozen eggs', 'some good olive oil', 'whatever bread looks fine']) {
			const result = parseIngredient(line)
			expect(result.name).toBe(line)
			expect(result.amount).toBeUndefined()
		}
	})
})

describe('formatIngredient', () => {
	it('round-trips a fully specified ingredient', () => {
		const line = '2 cans coconut milk'
		expect(formatIngredient(parseIngredient(line))).toBe(line)
	})

	it('round-trips a bare name', () => {
		expect(formatIngredient(parseIngredient('olive oil'))).toBe('olive oil')
	})

	it('round-trips a count with no unit', () => {
		expect(formatIngredient(parseIngredient('3 bell pepper'))).toBe('3 bell pepper')
	})

	it('omits absent parts rather than leaving gaps', () => {
		expect(formatIngredient({ name: 'rice' })).toBe('rice')
		expect(formatIngredient({ name: 'rice', unit: 'bag' })).toBe('bag rice')
		expect(formatIngredient({ name: 'rice', amount: 2 })).toBe('2 rice')
	})
})
