import { db } from '@/db'
import {
	SCHEMA_VERSION,
	type CheckedItem,
	type ExtraItem,
	type Meal,
	type MealPull,
	type PlanEntry,
	type Settings,
} from '@/types'

/*
JSON export/import. IndexedDB is device-local and browsers can evict it, so
this is the safety net — and it doubles as the way to move data between the
phone and a desktop.
*/

export interface Backup {
	format: 'food-organizer-backup'
	schemaVersion: number
	exportedAt: string
	meals: Meal[]
	extras: ExtraItem[]
	plan: PlanEntry[]
	pulls: MealPull[]
	checked: CheckedItem[]
	settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
	const [meals, extras, plan, pulls, checked, settings] = await Promise.all([
		db.meals.toArray(),
		db.extras.toArray(),
		db.plan.toArray(),
		db.pulls.toArray(),
		db.checked.toArray(),
		db.settings.toArray(),
	])

	return {
		format: 'food-organizer-backup',
		schemaVersion: SCHEMA_VERSION,
		exportedAt: new Date().toISOString(),
		meals,
		extras,
		plan,
		pulls,
		checked,
		settings,
	}
}

/** Triggers a file download of the current database. */
export async function downloadBackup(): Promise<void> {
	const backup = await exportBackup()
	const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const date = backup.exportedAt.slice(0, 10)

	const link = document.createElement('a')
	link.href = url
	link.download = `pantry-backup-${date}.json`
	link.click()

	URL.revokeObjectURL(url)
}

export class BackupFormatError extends Error {}

function assertBackup(value: unknown): asserts value is Backup {
	if (!value || typeof value !== 'object') {
		throw new BackupFormatError('That file is not a backup.')
	}

	const candidate = value as Partial<Backup>

	if (candidate.format !== 'food-organizer-backup') {
		throw new BackupFormatError('That file is not a Pantry backup.')
	}

	if (typeof candidate.schemaVersion !== 'number' || candidate.schemaVersion > SCHEMA_VERSION) {
		throw new BackupFormatError(
			`That backup was made by a newer version of the app (schema ${candidate.schemaVersion}).`,
		)
	}

	if (!Array.isArray(candidate.meals)) {
		throw new BackupFormatError('That backup is missing its meals.')
	}
}

/**
 * Replace the entire database with a backup's contents.
 *
 * Destructive and all-or-nothing: it runs in one transaction, so a malformed
 * file leaves the existing data untouched rather than half-overwritten.
 */
export async function restoreBackup(json: string): Promise<void> {
	let parsed: unknown

	try {
		parsed = JSON.parse(json)
	} catch {
		throw new BackupFormatError('That file is not valid JSON.')
	}

	assertBackup(parsed)

	const tables = [db.meals, db.extras, db.plan, db.pulls, db.checked, db.settings]

	await db.transaction('rw', tables, async () => {
		await Promise.all([
			db.meals.clear(),
			db.extras.clear(),
			db.plan.clear(),
			db.pulls.clear(),
			db.checked.clear(),
			db.settings.clear(),
		])

		await Promise.all([
			db.meals.bulkPut(parsed.meals),
			db.extras.bulkPut(parsed.extras ?? []),
			db.plan.bulkPut(parsed.plan ?? []),
			// Absent in a pre-v5 backup, whose plan meant "every ingredient is on
			// the list". Restoring that as no pulls at all is the safe direction:
			// the meals are still planned and one tap puts them back, whereas
			// inventing pulls would re-buy a trip that may already have happened.
			db.pulls.bulkPut(parsed.pulls ?? []),
			db.checked.bulkPut(parsed.checked ?? []),
			db.settings.bulkPut(parsed.settings ?? []),
		])
	})
}
