/*
The shopping list is DERIVED, never stored. This module is a pure function of
(meals, plan, extras) with no Vue and no database in sight, which is what makes
it testable — and it is the part of the app most worth testing.

Ported from the design prototype's `buildItems` / `groups`, with one deliberate
change: items merge on a normalized name (trimmed, lowercased) rather than on
an exact string match, so "Bell Pepper" and "bell pepper" are one line.
*/
import type { ExtraItem, Meal, ShopView, Store } from '@/types'
import { STORE_LABELS } from '@/types'
import { sumQuantities } from './quantities'

/** Merge key for an ingredient. Extras never merge — they key off their id. */
export function itemKey(name: string): string {
	return name.trim().toLowerCase()
}

export function extraKey(extraId: string): string {
	return `x:${extraId}`
}

export interface ListItem {
	/** Stable identity, and what `checked` is keyed by. */
	key: string
	name: string
	/** Aggregate quantity across every contributing meal. */
	qty: string
	store: Store
	/** Display names of the meals needing this, in plan order. */
	meals: string[]
	mealIds: string[]
	/** This meal's own contribution, for the by-meal view. */
	perMeal: Record<string, string>
	isExtra: boolean
}

export interface ListGroup {
	title: string
	items: DisplayItem[]
}

export interface DisplayItem {
	key: string
	name: string
	/** Aggregate, except in the by-meal view where it is that meal's own amount. */
	qty: string
	meta: string
}

/**
 * Resolve one merged item's store from every contributor's.
 *
 * `either` wins outright, and a Costco/Walmart disagreement also resolves to
 * `either` — in both cases the item genuinely can be bought at either place, so
 * it should appear under both. `wherever` only survives if nothing else claims
 * the item.
 */
function resolveStore(stores: Set<Store>): Store {
	if (stores.has('either')) return 'either'
	if (stores.has('costco') && stores.has('walmart')) return 'either'

	for (const store of stores) {
		if (store !== 'wherever') return store
	}

	return 'wherever'
}

/**
 * Walk the planned meals, merge their ingredients by name, then append extras.
 * Sorted alphabetically.
 */
export function buildItems(
	meals: readonly Meal[],
	plan: readonly string[],
	extras: readonly ExtraItem[],
): ListItem[] {
	const byId = new Map(meals.map((meal) => [meal.id, meal]))
	const merged = new Map<
		string,
		{
			key: string
			name: string
			parts: { amount: number; unit: string }[]
			perMealParts: Record<string, { amount: number; unit: string }[]>
			stores: Set<Store>
			meals: string[]
			mealIds: string[]
		}
	>()

	for (const mealId of plan) {
		const meal = byId.get(mealId)
		if (!meal) continue

		for (const ing of meal.ingredients) {
			const key = itemKey(ing.name)
			let entry = merged.get(key)

			if (!entry) {
				// First contributor's spelling wins as the display name.
				entry = {
					key,
					name: ing.name.trim(),
					parts: [],
					perMealParts: {},
					stores: new Set(),
					meals: [],
					mealIds: [],
				}
				merged.set(key, entry)
			}

			const part = { amount: ing.amount, unit: ing.unit }
			entry.parts.push(part)
			// A meal listing the same ingredient twice (oil in two steps) still
			// gets one combined per-meal amount, so accumulate and sum at the end.
			;(entry.perMealParts[mealId] ??= []).push(part)
			entry.stores.add(ing.store)

			if (!entry.mealIds.includes(mealId)) {
				entry.mealIds.push(mealId)
				entry.meals.push(meal.name)
			}
		}
	}

	const items: ListItem[] = [...merged.values()].map((entry) => ({
		key: entry.key,
		name: entry.name,
		qty: sumQuantities(entry.parts),
		store: resolveStore(entry.stores),
		meals: entry.meals,
		mealIds: entry.mealIds,
		perMeal: Object.fromEntries(
			Object.entries(entry.perMealParts).map(([mealId, parts]) => [mealId, sumQuantities(parts)]),
		),
		isExtra: false,
	}))

	for (const extra of extras) {
		items.push({
			key: extraKey(extra.id),
			name: extra.name,
			qty: extra.qty,
			store: extra.store,
			meals: [],
			mealIds: [],
			perMeal: {},
			isExtra: true,
		})
	}

	items.sort((a, b) => a.name.localeCompare(b.name))
	return items
}

/** Meta line under an item's name, which differs per view. */
function metaFor(item: ListItem, view: ShopView, mealId?: string): string {
	if (view === 'meal') {
		let meta = STORE_LABELS[item.store]
		const others = item.meals.filter((_, i) => item.mealIds[i] !== mealId)

		if (others.length) {
			meta += ` · also for ${others.join(', ')} (${item.qty} total)`
		}

		return meta
	}

	if (view === 'all') {
		return item.isExtra
			? `one-off · ${STORE_LABELS[item.store]}`
			: [STORE_LABELS[item.store], ...item.meals].join(' · ')
	}

	// By store: the store is already the group header, so name the meals instead.
	const meta = item.isExtra ? 'one-off' : item.meals.join(' · ')
	return item.store === 'either' ? (meta ? `${meta} · either store` : 'either store') : meta
}

function display(item: ListItem, view: ShopView, mealId?: string): DisplayItem {
	return {
		key: item.key,
		name: item.name,
		// The by-meal view shows that meal's own amount, not the aggregate.
		qty: (view === 'meal' && mealId && item.perMeal[mealId]) || item.qty,
		meta: metaFor(item, view, mealId),
	}
}

const STORE_GROUPS: { store: Store; title: string }[] = [
	{ store: 'costco', title: 'Costco' },
	{ store: 'walmart', title: 'Walmart' },
	{ store: 'wherever', title: 'Wherever' },
]

/** Bucket items into the display groups for a given view. Empty groups are omitted. */
export function groupItems(
	items: readonly ListItem[],
	view: ShopView,
	meals: readonly Meal[],
	plan: readonly string[],
): ListGroup[] {
	if (view === 'all') {
		if (!items.length) return []
		return [{ title: 'Everything', items: items.map((i) => display(i, 'all')) }]
	}

	if (view === 'meal') {
		const byId = new Map(meals.map((meal) => [meal.id, meal]))
		const groups: ListGroup[] = []

		for (const mealId of plan) {
			const meal = byId.get(mealId)
			if (!meal) continue

			const list = items.filter((i) => i.mealIds.includes(mealId))
			if (list.length) {
				groups.push({ title: meal.name, items: list.map((i) => display(i, 'meal', mealId)) })
			}
		}

		const loose = items.filter((i) => i.isExtra)
		if (loose.length) {
			groups.push({ title: 'One-offs', items: loose.map((i) => display(i, 'meal')) })
		}

		return groups
	}

	return STORE_GROUPS.flatMap(({ store, title }) => {
		// An `either` item belongs under both Costco and Walmart — you decide at
		// the shelf — but never under Wherever.
		const list = items.filter(
			(i) => i.store === store || (i.store === 'either' && store !== 'wherever'),
		)

		return list.length ? [{ title, items: list.map((i) => display(i, 'store')) }] : []
	})
}
