/*
The v2 -> v3 migration: the thirteen seeded tags are replaced by the three the
app ships with now. Anything else offered as a tag is inferred from the meals.

Its own file, like the v1 -> v2 test, because opening the app database at its
current version first would skip the upgrade path entirely.
*/
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TAGS, SCHEMA_VERSION } from '@/types'

/** The v2 settings shape: a stored list of preset tags. */
interface LegacySettings {
	id: string
	schemaVersion: number
	staleWeeks: number
	defaultShopView: string
	showSuggestions: boolean
	tags: string[]
}

const V2_STORES = {
	meals: 'id, name, lastMadeAt, archived, *tags',
	extras: 'id, createdAt, kind',
	plan: 'mealId, sortIndex',
	checked: 'key',
	settings: 'id',
}

describe('settings v2 -> v3 migration', () => {
	it('resets the stored tag vocabulary and keeps the rest of the settings', async () => {
		const legacy = new Dexie('food-organizer')
		legacy.version(1).stores(V2_STORES)
		legacy.version(2).stores(V2_STORES)

		await legacy.open()
		await legacy.table<LegacySettings>('settings').put({
			id: 'app',
			schemaVersion: 2,
			staleWeeks: 7,
			defaultShopView: 'meal',
			showSuggestions: false,
			tags: ['Weekend project', 'Greek'],
		})
		legacy.close()

		// Now open through the real app schema, which triggers the upgrade.
		const { db } = await import('@/db')
		await db.open()

		const migrated = (await db.settings.get('app')) as LegacySettings | undefined

		expect(migrated).toBeDefined()
		expect(migrated?.tags).toEqual(DEFAULT_TAGS)
		expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION)

		// Everything the user actually chose survives untouched.
		expect(migrated).toMatchObject({
			staleWeeks: 7,
			defaultShopView: 'meal',
			showSuggestions: false,
		})
	})
})
