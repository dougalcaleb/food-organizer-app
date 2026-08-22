import { db } from '@/db'
import { toPlain } from '@/db/plain'
import { DEFAULT_SETTINGS, type Settings } from '@/types'

/** Reads the singleton settings row, writing defaults on first run. */
export async function loadSettings(): Promise<Settings> {
	const stored = await db.settings.get('app')
	if (stored) return { ...DEFAULT_SETTINGS, ...stored }

	await db.settings.put(DEFAULT_SETTINGS)
	return { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
	await db.settings.put(toPlain(settings))
}
