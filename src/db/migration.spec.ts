/*
The v1 -> v2 migration runs against whatever is already on the user's device,
so it gets its own test file: it has to open a genuine v1 database, populate it
with old-shape records, then let the real AppDatabase upgrade it.

Isolated from db.spec.ts because opening the app database at v2 first would
skip the upgrade path entirely.
*/
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

/** The v1 extras shape: no `kind`, no `active`. */
interface LegacyExtra {
	id: string
	name: string
	qty: string
	store: string
	createdAt: number
}

describe('extras v1 -> v2 migration', () => {
	it('marks pre-existing extras as active one-offs', async () => {
		const legacy = new Dexie('food-organizer')
		legacy.version(1).stores({
			meals: 'id, name, lastMadeAt, archived, *tags',
			extras: 'id, createdAt',
			plan: 'mealId, sortIndex',
			checked: 'key',
			settings: 'id',
		})

		await legacy.open()
		await legacy.table<LegacyExtra>('extras').bulkPut([
			{ id: 'old1', name: 'paper towels', qty: '1 pack', store: 'costco', createdAt: 1 },
			{ id: 'old2', name: 'coffee beans', qty: '2 bags', store: 'either', createdAt: 2 },
		])
		legacy.close()

		// Now open through the real app schema, which triggers the upgrade.
		const { db } = await import('@/db')
		await db.open()

		const migrated = await db.extras.orderBy('createdAt').toArray()
		expect(migrated).toHaveLength(2)

		for (const extra of migrated) {
			// The old single-kind behavior meant exactly this: a one-off, on the list.
			expect(extra.kind).toBe('oneoff')
			expect(extra.active).toBe(true)
		}

		// Nothing else about the records was disturbed.
		expect(migrated[0]).toMatchObject({ id: 'old1', name: 'paper towels', qty: '1 pack' })
	})
})
