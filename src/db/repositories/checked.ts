import { db } from '@/db'

export async function checkedKeys(): Promise<string[]> {
	const rows = await db.checked.toArray()
	return rows.map((r) => r.key)
}

export async function setChecked(key: string, checked: boolean): Promise<void> {
	if (checked) {
		await db.checked.put({ key })
	} else {
		await db.checked.delete(key)
	}
}

export async function clearChecked(): Promise<void> {
	await db.checked.clear()
}
