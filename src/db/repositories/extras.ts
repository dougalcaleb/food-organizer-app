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
