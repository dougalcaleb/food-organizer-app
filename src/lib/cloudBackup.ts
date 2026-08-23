import type { Backup } from '@/db/backup'
import { BACKUP_TOKEN } from '@/lib/backupToken'

/*
The cloud half of the backup story. `db/backup.ts` still owns the JSON shape
and the local export/import; this file is only about getting that JSON to and
from the /api/backup endpoint defined in `infra/hosting.yaml`, plus the two
rules about when it is allowed to happen.

The endpoint is same-origin (a CloudFront behavior in front of a Lambda), so
there is no base URL to configure and no CORS. Authentication is a bearer token
compiled into the bundle, which means it is public -- see the "Cloud backup"
section of CLAUDE.md for why that is an accepted trade here and what it does
and does not buy.
*/

const ENDPOINT = '/api/backup'

/** Behind a function so a test can mock the one-line module it comes from. */
function token(): string {
	return BACKUP_TOKEN
}

/**
 * Without a token there is no endpoint to talk to, and every cloud feature
 * hides rather than failing. A checkout with `BACKUP_TOKEN` still empty --
 * which is how the repo ships -- behaves exactly as it did before this feature
 * existed.
 */
export function cloudBackupConfigured(): boolean {
	return token() !== ''
}

export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export function backupIsDue(lastAt: number | null, now: number = Date.now()): boolean {
	if (lastAt == null) return true
	// A stamp in the future -- a clock that moved backwards, or a restore
	// carrying someone else's -- would otherwise park the app on "not due yet"
	// forever, which is the one failure mode nobody would notice.
	if (lastAt > now) return true
	return now - lastAt >= BACKUP_INTERVAL_MS
}

/**
 * The guard that keeps this a safety net rather than a way to lose everything.
 *
 * The sequence to worry about: the browser evicts IndexedDB, the app opens
 * empty, the weekly check fires, and an empty database is written over a good
 * backup. A new install has nothing worth storing anyway, so "no meals" is a
 * safe stand-in for "this database is not real yet". The Lambda repeats this
 * check, because a client-side-only guard is one bad build away from gone.
 */
export function isSafeToUpload(backup: Backup): boolean {
	return backup.meals.length > 0
}

export class CloudBackupError extends Error {}

async function send(method: 'GET' | 'PUT', body?: string): Promise<unknown> {
	if (!cloudBackupConfigured()) {
		throw new CloudBackupError('Cloud backup is not configured in this build.')
	}

	let response: Response

	try {
		response = await fetch(ENDPOINT, {
			method,
			body,
			headers: {
				authorization: `Bearer ${token()}`,
				...(body ? { 'content-type': 'application/json' } : {}),
			},
		})
	} catch {
		// Offline, or the endpoint is unreachable. Expected often enough on a
		// phone that it must not read as a bug.
		throw new CloudBackupError('Could not reach the backup service.')
	}

	if (response.status === 401) {
		throw new CloudBackupError('The backup service rejected this app’s token.')
	}

	if (!response.ok) {
		throw new CloudBackupError(`The backup service failed (${response.status}).`)
	}

	try {
		return await response.json()
	} catch {
		// The distribution rewrites 403 and 404 to index.html with a 200, so a
		// misrouted request arrives here as HTML rather than as an error status.
		throw new CloudBackupError('The backup service returned something unexpected.')
	}
}

/** Returns the epoch ms the service recorded the backup at. */
export async function uploadBackup(backup: Backup): Promise<number> {
	if (!isSafeToUpload(backup)) {
		throw new CloudBackupError('Refusing to overwrite the backup with an empty database.')
	}

	const body = (await send('PUT', JSON.stringify(backup))) as { savedAt?: string }
	const savedAt = body.savedAt ? Date.parse(body.savedAt) : NaN

	return Number.isNaN(savedAt) ? Date.now() : savedAt
}

export interface StoredBackup {
	backup: Backup
	savedAt: number | null
}

/** Null when the service is reachable but has never been written to. */
export async function fetchStoredBackup(): Promise<StoredBackup | null> {
	const body = (await send('GET')) as {
		present?: boolean
		savedAt?: string | null
		backup?: Backup
	}

	if (!body.present || !body.backup) return null

	const savedAt = body.savedAt ? Date.parse(body.savedAt) : NaN

	return { backup: body.backup, savedAt: Number.isNaN(savedAt) ? null : savedAt }
}
