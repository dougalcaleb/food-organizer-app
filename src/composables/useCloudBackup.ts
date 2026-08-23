import { readonly, ref } from 'vue'
import { db } from '@/db'
import { exportBackup, restoreBackup } from '@/db/backup'
import {
	CloudBackupError,
	backupIsDue,
	cloudBackupConfigured,
	fetchStoredBackup,
	uploadBackup,
} from '@/lib/cloudBackup'
import { hydrateStores } from '@/stores'
import { useSettingsStore } from '@/stores/settings'

/*
Orchestration for the cloud backup: the launch check, and the two buttons in
Settings. The rules themselves live in `lib/cloudBackup.ts`; the transport does
too. This file is only the part that needs stores and reactivity.

State is module-level rather than per-caller, so the banner in App.vue and the
Settings sheet are looking at the same thing.
*/

export type CloudBackupStatus = 'idle' | 'working' | 'done' | 'error'

const status = ref<CloudBackupStatus>('idle')
const message = ref<string | null>(null)

/**
 * Set at launch when this device has no meals but the service does have a
 * backup — which is either a fresh install or, the case worth catching, an
 * eviction. Nothing is restored automatically: overwriting is the user's call,
 * and a wrong guess here is the one that costs data.
 */
const restoreOffered = ref(false)

function fail(error: unknown): false {
	status.value = 'error'
	message.value =
		error instanceof CloudBackupError ? error.message : 'Something went wrong backing up.'
	return false
}

export function useCloudBackup() {
	async function backUpNow(): Promise<boolean> {
		status.value = 'working'
		message.value = null

		try {
			const savedAt = await uploadBackup(await exportBackup())
			await useSettingsStore().update({ lastCloudBackupAt: savedAt })

			status.value = 'done'
			message.value = null
			return true
		} catch (error) {
			return fail(error)
		}
	}

	/** Destructive: the stored backup replaces everything on this device. */
	async function restoreFromCloud(): Promise<boolean> {
		status.value = 'working'
		message.value = null

		try {
			const stored = await fetchStoredBackup()

			if (!stored) {
				status.value = 'error'
				message.value = 'There is no backup stored yet.'
				return false
			}

			await restoreBackup(JSON.stringify(stored.backup))
			await hydrateStores()

			restoreOffered.value = false
			status.value = 'done'
			return true
		} catch (error) {
			return fail(error)
		}
	}

	return {
		status: readonly(status),
		message: readonly(message),
		restoreOffered: readonly(restoreOffered),
		configured: cloudBackupConfigured(),
		backUpNow,
		restoreFromCloud,
		dismissRestoreOffer: () => {
			restoreOffered.value = false
		},
	}
}

/**
 * Called once from `main.ts` after mount. Never awaited by the boot sequence
 * and never throws: a weekly backup is not worth delaying first paint for, and
 * a phone that happens to be offline at launch is the normal case, not a bug
 * to report. Settings shows the real last-backup date, and "Back up now" is
 * where a failure gets an error message.
 */
export async function runCloudBackupOnLaunch(): Promise<void> {
	if (!cloudBackupConfigured()) return

	try {
		// Counted straight from the table rather than from the meals store,
		// which filters archived meals out — a database holding nothing but
		// archived meals is still a database worth not overwriting.
		if ((await db.meals.count()) === 0) {
			restoreOffered.value = (await fetchStoredBackup()) !== null
			return
		}

		const settings = useSettingsStore()
		if (!backupIsDue(settings.settings.lastCloudBackupAt)) return

		const savedAt = await uploadBackup(await exportBackup())
		await settings.update({ lastCloudBackupAt: savedAt })
	} catch {
		// Deliberately silent — see above.
	}
}
