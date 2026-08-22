/** Where an item is usually bought. */
export type Store = 'costco' | 'walmart' | 'either' | 'wherever'

/**
 * `either` = buy at Costco if bulk makes sense, otherwise Walmart.
 * `wherever` = no usual store (spices, produce oddities).
 */
export const STORE_LABELS: Record<Store, string> = {
	costco: 'Costco',
	walmart: 'Walmart',
	either: 'Either',
	wherever: 'Wherever',
}

export const STORES = Object.keys(STORE_LABELS) as Store[]

export interface Ingredient {
	name: string
	amount: number
	/** May be empty for countable things ("3 bell pepper"). */
	unit: string
	store: Store
}

export interface Meal {
	id: string
	name: string
	tags: string[]
	notes: string
	/**
	 * Epoch ms of the last time this was cooked, or null if never. Weeks-since
	 * is always derived from this — never stored.
	 */
	lastMadeAt: number | null
	ingredients: Ingredient[]
	createdAt: number
	updatedAt: number
	/** Soft delete: archived meals stay out of every list but keep their history. */
	archived: boolean
}

/** A one-off shopping item, not tied to any meal. */
export interface ExtraItem {
	id: string
	name: string
	qty: string
	store: Store
	createdAt: number
}

export interface PlanEntry {
	mealId: string
	addedAt: number
	sortIndex: number
}

/**
 * A checked-off shopping item, keyed by merged item rather than by
 * (meal, ingredient) — you buy onions once, so checking onions off clears it
 * everywhere. See `itemKey()` in lib/shoppingList.
 */
export interface CheckedItem {
	key: string
}

export type ShopView = 'store' | 'meal' | 'all'
export type IdeaSort = 'stale' | 'recent' | 'az'

export interface Settings {
	id: 'app'
	schemaVersion: number
	/** Weeks after which a meal counts as "been a while". */
	staleWeeks: number
	defaultShopView: ShopView
	showSuggestions: boolean
	/** Editable tag vocabulary; seeded from the design's three axes. */
	tags: string[]
}

export const DEFAULT_TAGS = [
	'Quick',
	'Weekend project',
	'Dinner',
	'Lunch',
	'Breakfast',
	'Thai',
	'Italian',
	'Mexican',
	'American',
	'Greek',
	'Japanese',
	'Indian',
	'Middle Eastern',
]

export const SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
	id: 'app',
	schemaVersion: SCHEMA_VERSION,
	staleWeeks: 12,
	defaultShopView: 'store',
	showSuggestions: true,
	tags: DEFAULT_TAGS,
}
