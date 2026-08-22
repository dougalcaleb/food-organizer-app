/**
 * Ask the browser to make our IndexedDB storage persistent, so it is not
 * evicted when the device is low on space.
 *
 * This is the user's only copy of their data, so it is worth requesting — but
 * it is best-effort: Safari ignores it, and Chrome grants it based on
 * engagement heuristics (installing the PWA generally earns it). The result is
 * surfaced in settings so the user knows whether to lean on the JSON backup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!navigator.storage?.persist) return false

	try {
		if (await navigator.storage.persisted()) return true
		return await navigator.storage.persist()
	} catch {
		return false
	}
}

/** Bytes used / available, when the browser reports them. */
export async function storageEstimate(): Promise<StorageEstimate | null> {
	if (!navigator.storage?.estimate) return null

	try {
		return await navigator.storage.estimate()
	} catch {
		return null
	}
}
