import { db } from '@/db'
import type { PlanEntry } from '@/types'

/** Planned meal ids in the user's order. */
export async function planIds(): Promise<string[]> {
	const entries = await db.plan.orderBy('sortIndex').toArray()
	return entries.map((e) => e.mealId)
}

export async function addToPlan(mealId: string): Promise<void> {
	await db.transaction('rw', db.plan, async () => {
		if (await db.plan.get(mealId)) return

		const last = await db.plan.orderBy('sortIndex').last()
		const entry: PlanEntry = {
			mealId,
			addedAt: Date.now(),
			sortIndex: (last?.sortIndex ?? -1) + 1,
		}

		await db.plan.put(entry)
	})
}

export async function removeFromPlan(mealId: string): Promise<void> {
	await db.plan.delete(mealId)
}

export async function clearPlan(): Promise<void> {
	await db.plan.clear()
}
