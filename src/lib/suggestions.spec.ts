import { describe, expect, it } from 'vitest'
import { suggestStaleMeals } from './suggestions'
import type { Meal } from '@/types'

const WEEK = 7 * 24 * 60 * 60 * 1000
const NOW = Date.now()

function meal(id: string, weeksAgo: number | null): Meal {
	return {
		id,
		name: id,
		tags: [],
		notes: '',
		lastMadeAt: weeksAgo === null ? null : NOW - weeksAgo * WEEK,
		ingredients: [],
		createdAt: 0,
		updatedAt: 0,
		archived: false,
	}
}

const opts = { staleWeeks: 12, showSuggestions: true }

describe('suggestStaleMeals', () => {
	it('returns only meals past the stale threshold', () => {
		const meals = [meal('fresh', 2), meal('stale', 20), meal('borderline', 11)]
		expect(suggestStaleMeals(meals, [], opts).map((m) => m.id)).toEqual(['stale'])
	})

	it('treats the threshold as inclusive', () => {
		expect(suggestStaleMeals([meal('exactly', 12)], [], opts)).toHaveLength(1)
	})

	it('excludes meals already in the plan', () => {
		const meals = [meal('planned', 30), meal('not-planned', 20)]
		expect(suggestStaleMeals(meals, ['planned'], opts).map((m) => m.id)).toEqual(['not-planned'])
	})

	it('orders most forgotten first', () => {
		const meals = [meal('mid', 20), meal('worst', 40), meal('least', 13)]
		expect(suggestStaleMeals(meals, [], opts).map((m) => m.id)).toEqual(['worst', 'mid', 'least'])
	})

	it('leads with never-made meals', () => {
		const meals = [meal('ancient', 40), meal('never', null)]
		expect(suggestStaleMeals(meals, [], opts).map((m) => m.id)).toEqual(['never', 'ancient'])
	})

	it('caps the list so it never dominates the tab', () => {
		const meals = [20, 30, 40, 50, 60].map((w) => meal(`m${w}`, w))
		expect(suggestStaleMeals(meals, [], opts)).toHaveLength(3)
	})

	it('honours the settings toggle', () => {
		const meals = [meal('stale', 40)]
		expect(suggestStaleMeals(meals, [], { ...opts, showSuggestions: false })).toEqual([])
	})

	it('follows a changed threshold', () => {
		const meals = [meal('eight-weeks', 8)]
		expect(suggestStaleMeals(meals, [], opts)).toHaveLength(0)
		expect(suggestStaleMeals(meals, [], { ...opts, staleWeeks: 6 })).toHaveLength(1)
	})

	it('is empty when nothing is stale', () => {
		expect(suggestStaleMeals([meal('fresh', 1)], [], opts)).toEqual([])
	})
})
