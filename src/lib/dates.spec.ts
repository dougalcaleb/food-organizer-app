import { describe, expect, it } from 'vitest'
import { lastMadeLabel, recentFirst, staleFirst, weekLabel, weeksSince } from './dates'

const WEEK = 7 * 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

const meal = (name: string, weeksAgo: number | null) => ({
	name,
	lastMadeAt: weeksAgo === null ? null : NOW - weeksAgo * WEEK,
})

describe('weeksSince', () => {
	it('counts whole weeks', () => {
		expect(weeksSince(NOW - 3 * WEEK, NOW)).toBe(3)
	})

	it('treats never-made as infinitely stale', () => {
		expect(weeksSince(null, NOW)).toBe(Infinity)
	})

	it('never reports negative weeks for a future timestamp', () => {
		expect(weeksSince(NOW + 5 * WEEK, NOW)).toBe(0)
	})
})

describe('weekLabel', () => {
	it.each([
		[0, 'made this week'],
		[1, '1 week ago'],
		[7, '7 weeks ago'],
		[51, '51 weeks ago'],
		[52, 'over a year ago'],
		[200, 'over a year ago'],
		[Infinity, 'never made'],
	])('labels %s weeks as "%s"', (weeks, expected) => {
		expect(weekLabel(weeks)).toBe(expected)
	})

	it('labels a null lastMadeAt', () => {
		expect(lastMadeLabel(null)).toBe('never made')
	})
})

describe('staleFirst', () => {
	it('puts the longest-ago meal first', () => {
		const meals = [meal('recent', 1), meal('ancient', 40), meal('middling', 10)]
		expect([...meals].sort(staleFirst).map((m) => m.name)).toEqual([
			'ancient',
			'middling',
			'recent',
		])
	})

	it('leads with never-made meals', () => {
		const meals = [meal('made', 40), meal('never', null)]
		expect([...meals].sort(staleFirst).map((m) => m.name)).toEqual(['never', 'made'])
	})

	it('orders several never-made meals stably by name', () => {
		// The NaN case: Infinity - Infinity is not a valid comparator result, so
		// this must not depend on subtracting week counts.
		const meals = [meal('carrot', null), meal('apple', null), meal('banana', null)]
		expect([...meals].sort(staleFirst).map((m) => m.name)).toEqual(['apple', 'banana', 'carrot'])
	})

	it('is a valid comparator for every pairing', () => {
		const meals = [meal('a', null), meal('b', null), meal('c', 5), meal('d', 5)]

		for (const x of meals) {
			for (const y of meals) {
				expect(Number.isNaN(staleFirst(x, y))).toBe(false)
			}
		}
	})
})

describe('recentFirst', () => {
	it('reverses staleFirst, leaving never-made last', () => {
		const meals = [meal('never', null), meal('ancient', 40), meal('recent', 1)]
		expect([...meals].sort(recentFirst).map((m) => m.name)).toEqual(['recent', 'ancient', 'never'])
	})
})
