import { db } from '@/db'
import { toPlain } from '@/db/plain'
import type { MealPull } from '@/types'

/*
Which of each planned meal's ingredients are currently on the shopping list.

One record per meal, written whole: the set of pulled names is small and always
changes as a set (a whole meal added, one ingredient unticked, everything
bought), so there is nothing to gain from a finer-grained write path.
*/

export async function allPulls(): Promise<MealPull[]> {
	return db.pulls.toArray()
}

export async function putPull(pull: MealPull): Promise<void> {
	await db.pulls.put(toPlain(pull))
}

export async function deletePull(mealId: string): Promise<void> {
	await db.pulls.delete(mealId)
}

/** Used by `clearCart`, which resolves several meals' pulls in one go. */
export async function writePulls(pulls: MealPull[], deleted: string[]): Promise<void> {
	await db.transaction('rw', db.pulls, async () => {
		await db.pulls.bulkDelete(deleted)
		await db.pulls.bulkPut(toPlain(pulls))
	})
}
