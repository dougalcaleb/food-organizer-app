import Dexie, { type EntityTable } from 'dexie'
import type { CheckedItem, ExtraItem, Meal, PlanEntry, Settings } from '@/types'

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
	}
}

export const db = new AppDatabase()
