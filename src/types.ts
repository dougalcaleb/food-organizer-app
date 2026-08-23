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

/**
 * Only `name` is required. Jotting "olive oil" with no amount and no store is a
 * legitimate entry — the point of the app is capturing an idea before it is
 * gone, not filling in a form. Anything missing simply is not displayed, and a
 * missing store is treated as `wherever`.
 */
export interface Ingredient {
	name: string
	amount?: number
	/** Empty or absent for countable things ("3 bell pepper"). */
	unit?: string
	store?: Store
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

/**
 * Two kinds of shopping item that are not tied to any meal:
 *
 *   oneoff — bought once and done (paper towels). Deleted after the trip.
 *   staple — bought regularly (milk, butter). Rests on the Staples shelf and
 *            returns there after the trip, so it never has to be retyped.
 */
export type ExtraKind = 'oneoff' | 'staple'

export interface ExtraItem {
	id: string
	name: string
	qty: string
	store: Store
	kind: ExtraKind
	/**
	 * Whether this is on the current shopping list. One-offs are created active
	 * and deleted once bought; staples toggle between the list and the shelf.
	 */
	active: boolean
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
	/**
	 * The pinned tag vocabulary, editable in Settings. Everything else offered
	 * as a tag is inferred from the meals themselves; these three are simply
	 * always on the front of that list.
	 */
	tags: string[]
}

/** Seeded, not exhaustive — new tags are born by typing one in the editor. */
export const DEFAULT_TAGS = ['Breakfast', 'Lunch', 'Dinner']

export const SCHEMA_VERSION = 3

export const DEFAULT_SETTINGS: Settings = {
	id: 'app',
	schemaVersion: SCHEMA_VERSION,
	staleWeeks: 12,
	defaultShopView: 'store',
	showSuggestions: true,
	tags: DEFAULT_TAGS,
}
