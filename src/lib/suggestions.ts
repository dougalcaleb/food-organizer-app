/*
The "been a while" rule.

This is the mechanism that makes keeping an Ideas library worthwhile: without
something actively resurfacing old meals, the same four dinners get cooked and
the rest quietly rot in the list.
*/
import { staleFirst, weeksSince } from './dates'
import type { Meal } from '@/types'

export interface SuggestionOptions {
	staleWeeks: number
	showSuggestions: boolean
	/** The design shows at most three, so the block never dominates the tab. */
	limit?: number
}

/**
 * Meals worth reconsidering: not already planned, stale enough to have been
 * forgotten, most forgotten first.
 *
 * Never-made meals qualify and lead the list — an idea jotted down and never
 * cooked is the most forgotten thing there is.
 */
export function suggestStaleMeals(
	meals: readonly Meal[],
	plannedIds: readonly string[],
	{ staleWeeks, showSuggestions, limit = 3 }: SuggestionOptions,
): Meal[] {
	if (!showSuggestions) return []

	const planned = new Set(plannedIds)

	return meals
		.filter((meal) => !planned.has(meal.id) && weeksSince(meal.lastMadeAt) >= staleWeeks)
		.sort(staleFirst)
		.slice(0, limit)
}
