/*
The v3 -> v4 migration: settings gain `lastCloudBackupAt`, the stamp the launch
check compares against.

Its own file, like the earlier migration tests, because opening the app
database at its current version first would skip the upgrade path entirely.

The field could have been left to `loadSettings`, which spreads defaults over
whatever is stored — but then an existing install would carry a settings row
claiming schemaVersion 3 forever, and a broken migration is the failure that
corrupts real data on the user's next visit rather than in a test.
*/
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '@/types'

/** The v3 settings shape: everything the app had before the cloud backup. */
interface LegacySettings {
	id: string
	schemaVersion: number
	staleWeeks: number
	defaultShopView: string
	showSuggestions: boolean
	tags: string[]
	lastCloudBackupAt?: number | null
}

const V3_STORES = {
	meals: 'id, name, lastMadeAt, archived, *tags',
	extras: 'id, createdAt, kind',
	plan: 'mealId, sortIndex',
	checked: 'key',
	settings: 'id',
}

describe('settings v3 -> v4 migration', () => {
	it('adds the cloud backup stamp and leaves the rest of the settings alone', async () => {
		const legacy = new Dexie('food-organizer')
		legacy.version(1).stores(V3_STORES)
		legacy.version(2).stores(V3_STORES)
		legacy.version(3).stores(V3_STORES)

		await legacy.open()
		await legacy.table<LegacySettings>('settings').put({
			id: 'app',
			schemaVersion: 3,
			staleWeeks: 9,
			defaultShopView: 'all',
			showSuggestions: false,
			tags: ['Breakfast'],
		})
		legacy.close()

		// Now open through the real app schema, which triggers the upgrade.
		const { db } = await import('@/db')
		await db.open()

		const migrated = (await db.settings.get('app')) as LegacySettings | undefined

		expect(migrated).toBeDefined()
		// Explicitly null, not absent: "never backed up" is a real state, and the
		// launch check treats it as immediately due.
		expect(migrated?.lastCloudBackupAt).toBeNull()
		expect(migrated?.schemaVersion).toBe(SCHEMA_VERSION)

		expect(migrated).toMatchObject({
			staleWeeks: 9,
			defaultShopView: 'all',
			showSuggestions: false,
			tags: ['Breakfast'],
		})
	})
})
