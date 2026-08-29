import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backup } from '@/db/backup'

/*
The token is a compiled-in constant rather than an environment variable, so it
is swapped here by mocking the one-line module that exports it. The getter is
what makes it per-test: a plain value would be captured once when the factory
runs, and the "no token" cases could not turn it off again.
*/
const tokenModule = vi.hoisted(() => ({ value: 'test-token' }))

vi.mock('@/lib/backupToken', () => ({
	get BACKUP_TOKEN() {
		return tokenModule.value
	},
}))

import {
	BACKUP_INTERVAL_MS,
	CloudBackupError,
	backupIsDue,
	cloudBackupConfigured,
	fetchStoredBackup,
	isSafeToUpload,
	uploadBackup,
} from '@/lib/cloudBackup'

function backup(overrides: Partial<Backup> = {}): Backup {
	return {
		format: 'food-organizer-backup',
		schemaVersion: 4,
		exportedAt: '2026-08-23T00:00:00.000Z',
		meals: [],
		extras: [],
		plan: [],
		pulls: [],
		checked: [],
		settings: [],
		...overrides,
	}
}

const oneMeal = [{ id: 'm1', name: 'Tacos' }] as unknown as Backup['meals']

/** A `fetch` returning one canned response. */
function stubFetch(body: unknown, init: { status?: number; text?: string } = {}) {
	const fetchMock = vi.fn().mockResolvedValue({
		ok: (init.status ?? 200) < 400,
		status: init.status ?? 200,
		json: async () => {
			if (init.text !== undefined) throw new SyntaxError('not json')
			return body
		},
	})

	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

beforeEach(() => {
	tokenModule.value = 'test-token'
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('cloudBackupConfigured', () => {
	it('is off without a token, so an unconfigured build hides the feature', () => {
		tokenModule.value = ''
		expect(cloudBackupConfigured()).toBe(false)
	})

	it('is on with one', () => {
		expect(cloudBackupConfigured()).toBe(true)
	})
})

describe('backupIsDue', () => {
	const now = Date.UTC(2026, 7, 23)

	it('is due when there has never been a backup', () => {
		expect(backupIsDue(null, now)).toBe(true)
	})

	it('is not due the day after one', () => {
		expect(backupIsDue(now - 24 * 60 * 60 * 1000, now)).toBe(false)
	})

	it('is due once the interval has passed', () => {
		expect(backupIsDue(now - BACKUP_INTERVAL_MS, now)).toBe(true)
		expect(backupIsDue(now - BACKUP_INTERVAL_MS + 1, now)).toBe(false)
	})

	/*
	A stamp in the future comes from a clock that moved backwards or from a
	restore carrying someone else's. Treating it as "not due" would park the app
	on never backing up again, which is the one failure nobody would notice.
	*/
	it('is due when the stored stamp is in the future', () => {
		expect(backupIsDue(now + BACKUP_INTERVAL_MS, now)).toBe(true)
	})
})

describe('isSafeToUpload', () => {
	it('rejects a database with no meals', () => {
		expect(isSafeToUpload(backup())).toBe(false)
	})

	it('accepts one with meals', () => {
		expect(isSafeToUpload(backup({ meals: oneMeal }))).toBe(true)
	})
})

describe('uploadBackup', () => {
	/*
	The sequence this guards: the browser evicts IndexedDB, the app opens empty,
	the weekly check fires, and an empty database lands on top of a good backup.
	It must not even reach the network.
	*/
	it('refuses an empty database without calling the service', async () => {
		const fetchMock = stubFetch({ ok: true })

		await expect(uploadBackup(backup())).rejects.toThrow(CloudBackupError)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('PUTs the backup with the bearer token and returns the recorded time', async () => {
		const fetchMock = stubFetch({ ok: true, savedAt: '2026-08-23T12:00:00.000Z' })

		const savedAt = await uploadBackup(backup({ meals: oneMeal }))

		expect(savedAt).toBe(Date.parse('2026-08-23T12:00:00.000Z'))

		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/backup')
		expect(init.method).toBe('PUT')
		expect(init.headers.authorization).toBe('Bearer test-token')
		expect(JSON.parse(init.body).format).toBe('food-organizer-backup')
	})

	it('reports a rejected token in words rather than a status code', async () => {
		stubFetch(null, { status: 401 })

		await expect(uploadBackup(backup({ meals: oneMeal }))).rejects.toThrow(/token/i)
	})

	it('does not attempt the network when the build has no token', async () => {
		tokenModule.value = ''
		const fetchMock = stubFetch({ ok: true })

		await expect(uploadBackup(backup({ meals: oneMeal }))).rejects.toThrow(CloudBackupError)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('survives an unreachable service', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

		await expect(uploadBackup(backup({ meals: oneMeal }))).rejects.toThrow(/reach/i)
	})
})

describe('fetchStoredBackup', () => {
	it('returns null when the service has never been written to', async () => {
		stubFetch({ present: false })
		expect(await fetchStoredBackup()).toBeNull()
	})

	it('returns the stored backup and when it was saved', async () => {
		const stored = backup({ meals: oneMeal })
		stubFetch({ present: true, savedAt: '2026-08-20T09:00:00.000Z', backup: stored })

		const result = await fetchStoredBackup()

		expect(result?.backup).toEqual(stored)
		expect(result?.savedAt).toBe(Date.parse('2026-08-20T09:00:00.000Z'))
	})

	/*
	The distribution rewrites 403 and 404 to index.html with a 200 for the SPA,
	and that cannot be scoped to one behavior — so a misrouted API call arrives
	as HTML with a success status rather than as an error.
	*/
	it('does not mistake the SPA fallback page for a backup', async () => {
		stubFetch(null, { status: 200, text: '<!doctype html>' })

		await expect(fetchStoredBackup()).rejects.toThrow(/unexpected/i)
	})
})
