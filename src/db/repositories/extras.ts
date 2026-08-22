import { db } from '@/db'
import { toPlain } from '@/db/plain'
import type { ExtraItem } from '@/types'

export async function allExtras(): Promise<ExtraItem[]> {
	return db.extras.orderBy('createdAt').toArray()
}

export async function putExtra(extra: ExtraItem): Promise<void> {
	await db.extras.put(toPlain(extra))
}

export async function deleteExtra(id: string): Promise<void> {
	await db.extras.delete(id)
}

export async function deleteExtras(ids: string[]): Promise<void> {
	await db.extras.bulkDelete(ids)
}

/** Move a staple on or off the current shopping list. */
export async function setExtraActive(id: string, active: boolean): Promise<void> {
	await db.extras.update(id, { active })
}

export async function setExtrasActive(ids: string[], active: boolean): Promise<void> {
	await db.transaction('rw', db.extras, async () => {
		await Promise.all(ids.map((id) => db.extras.update(id, { active })))
	})
}
