/*
The v4 -> v5 migration, which is the one that changes what the shopping list
means.

Under v4 a planned meal put every one of its ingredients on the list, full stop.
Under v5 nothing reaches the list until it is pulled — so an install upgrading
with three meals planned and a half-shopped list would otherwise open to an
empty one, with no way to tell what had already been bought. The upgrade writes
the pull v4 implied: everything, for every planned meal.

Its own file, like the other migration specs: opening the app database at v5
first would skip the upgrade path entirely.
*/
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

const V4_STORES = {
	meals: 'id, name, lastMadeAt, archived, *tags',
	extras: 'id, createdAt, kind',
	plan: 'mealId, sortIndex',
	checked: 'key',
	settings: 'id',
}

function legacyMeal(id: string, name: string, ingredients: { name: string }[]) {
	return {
		id,
		name,
		tags: [],
		notes: '',
		lastMadeAt: null,
		ingredients,
		createdAt: 1,
		updatedAt: 1,
		archived: false,
	}
}

describe('pulls v4 -> v5 migration', () => {
	it('gives every planned meal a pull covering all of its ingredients', async () => {
		const legacy = new Dexie('food-organizer')
		legacy.version(4).stores(V4_STORES)
		await legacy.open()

		await legacy
			.table('meals')
			.bulkPut([
				legacyMeal('curry', 'Curry', [{ name: 'Coconut Milk' }, { name: 'chicken thighs' }]),
				legacyMeal('chili', 'Chili', [{ name: 'kidney beans' }]),
				legacyMeal('ziti', 'Ziti', [{ name: 'ricotta' }]),
			])
		// Two of the three are planned; the third is only an idea.
		await legacy.table('plan').bulkPut([
			{ mealId: 'curry', addedAt: 1, sortIndex: 0 },
			{ mealId: 'chili', addedAt: 2, sortIndex: 1 },
		])
		await legacy.table('settings').put({
			id: 'app',
			schemaVersion: 4,
			staleWeeks: 12,
			defaultShopView: 'store',
			showSuggestions: true,
			tags: ['Breakfast'],
			lastCloudBackupAt: null,
		})
		legacy.close()

		const { db } = await import('@/db')
		await db.open()

		const pulls = await db.pulls.toArray()
		expect(pulls.map((p) => p.mealId).sort()).toEqual(['chili', 'curry'])

		// Normalized, because that is the key the shopping list merges on — a
		// pull written as "Coconut Milk" would match nothing.
		expect((await db.pulls.get('curry'))?.names).toEqual(['coconut milk', 'chicken thighs'])

		// An unplanned meal has nothing on the list, so it gets no pull.
		expect(await db.pulls.get('ziti')).toBeUndefined()

		expect((await db.settings.get('app'))?.schemaVersion).toBe(5)
	})
})
