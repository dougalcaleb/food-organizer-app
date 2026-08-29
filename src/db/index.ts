import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_TAGS } from '@/types'
import type { CheckedItem, ExtraItem, Meal, MealPull, PlanEntry, Settings } from '@/types'

/*
IndexedDB is the only copy of this data, so schema changes must go through
Dexie versions rather than by editing the version(1) stores line. Adding a
table or an index means appending a new `.version(n).stores({...})` block.

Only indexed properties are listed here; the rest of each record is stored as
given. Ingredients live embedded on Meal — they are never queried on their own.
*/
export class AppDatabase extends Dexie {
	meals!: EntityTable<Meal, 'id'>
	extras!: EntityTable<ExtraItem, 'id'>
	plan!: EntityTable<PlanEntry, 'mealId'>
	pulls!: EntityTable<MealPull, 'mealId'>
	checked!: EntityTable<CheckedItem, 'key'>
	settings!: EntityTable<Settings, 'id'>

	constructor() {
		super('food-organizer')

		this.version(1).stores({
			// *tags is a multiEntry index, so filtering by tag hits the index.
			meals: 'id, name, lastMadeAt, archived, *tags',
			extras: 'id, createdAt',
			plan: 'mealId, sortIndex',
			checked: 'key',
			settings: 'id',
		})

		// v2 splits extras into one-offs and recurring staples. Everything that
		// existed before was a one-off on the current list, which is exactly what
		// the old single-kind behavior meant.
		this.version(2)
			.stores({
				meals: 'id, name, lastMadeAt, archived, *tags',
				// `active` is deliberately not indexed: IndexedDB has no boolean key
				// type, so records would silently fall out of the index. The extras
				// table is a few dozen rows — filter it in memory.
				extras: 'id, createdAt, kind',
				plan: 'mealId, sortIndex',
				checked: 'key',
				settings: 'id',
			})
			.upgrade((tx) =>
				tx
					.table<ExtraItem>('extras')
					.toCollection()
					.modify((extra) => {
						extra.kind ??= 'oneoff'
						extra.active ??= true
					}),
			)

		// v3 resets the tag vocabulary. v1 seeded thirteen tags ("Weekend
		// project", "Greek") that were never used, leaving filter chips with
		// nothing behind them; the list is now three, and everything else is
		// inferred from the meals. No index changes — the stores line is repeated
		// because Dexie requires it.
		this.version(3)
			.stores({
				meals: 'id, name, lastMadeAt, archived, *tags',
				extras: 'id, createdAt, kind',
				plan: 'mealId, sortIndex',
				checked: 'key',
				settings: 'id',
			})
			.upgrade((tx) =>
				tx
					.table<Settings>('settings')
					.toCollection()
					.modify((settings) => {
						settings.tags = [...DEFAULT_TAGS]
						// Pinned to 3, not SCHEMA_VERSION: an upgrade step is a fixed
						// point in history and must not claim to have produced whatever
						// the current version happens to be. Anything opening at the
						// current schema runs the later steps too and ends up stamped
						// correctly by the last of them.
						settings.schemaVersion = 3
					}),
			)

		// v4 adds `lastCloudBackupAt` for the weekly cloud backup. No index
		// changes; the field is written here rather than left to loadSettings'
		// defaults so an existing install has an explicit null on disk and the
		// stored schemaVersion stays honest.
		this.version(4)
			.stores({
				meals: 'id, name, lastMadeAt, archived, *tags',
				extras: 'id, createdAt, kind',
				plan: 'mealId, sortIndex',
				checked: 'key',
				settings: 'id',
			})
			.upgrade((tx) =>
				tx
					.table<Settings>('settings')
					.toCollection()
					.modify((settings) => {
						settings.lastCloudBackupAt ??= null
						settings.schemaVersion = 4
					}),
			)

		// v5 stops a planned meal putting its own ingredients on the shopping
		// list. Ingredients are now PULLED onto the list a meal at a time, and a
		// bought one does not come back while the meal stays planned. The state
		// that records a pull is a new table.
		//
		// Everything currently planned had all of its ingredients on the list —
		// that is what v4 meant — so the upgrade writes exactly that, and an
		// existing install's list is unchanged on the first launch after it.
		this.version(5)
			.stores({
				meals: 'id, name, lastMadeAt, archived, *tags',
				extras: 'id, createdAt, kind',
				plan: 'mealId, sortIndex',
				pulls: 'mealId',
				checked: 'key',
				settings: 'id',
			})
			.upgrade(async (tx) => {
				const [planned, meals] = await Promise.all([
					tx.table<PlanEntry>('plan').toArray(),
					tx.table<Meal>('meals').toArray(),
				])

				const byId = new Map(meals.map((meal) => [meal.id, meal]))
				const now = Date.now()

				await tx.table<MealPull>('pulls').bulkPut(
					planned.flatMap((entry) => {
						const meal = byId.get(entry.mealId)
						if (!meal) return []

						return [
							{
								mealId: entry.mealId,
								// The same normalization `itemKey` applies, inlined:
								// an upgrade step must not drift with the app's code.
								names: [...new Set(meal.ingredients.map((i) => i.name.trim().toLowerCase()))],
								pulledAt: now,
							},
						]
					}),
				)

				await tx
					.table<Settings>('settings')
					.toCollection()
					.modify((settings) => {
						settings.schemaVersion = 5
					})
			})
	}
}

export const db = new AppDatabase()
