import { db } from '@/db'
import { toPlain } from '@/db/plain'
import type { Meal } from '@/types'

/** Everything not archived, alphabetical. */
export async function allMeals(): Promise<Meal[]> {
	const meals = await db.meals.toArray()
	return meals.filter((m) => !m.archived).sort((a, b) => a.name.localeCompare(b.name))
}

export async function putMeal(meal: Meal): Promise<void> {
	await db.meals.put(toPlain(meal))
}

export async function deleteMeal(id: string): Promise<void> {
	// Soft delete: the meal leaves every list but keeps its history, and any
	// plan entry pointing at it goes too.
	await db.transaction('rw', db.meals, db.plan, async () => {
		await db.meals.update(id, { archived: true, updatedAt: Date.now() })
		await db.plan.delete(id)
	})
}

export async function bulkPutMeals(meals: Meal[]): Promise<void> {
	await db.meals.bulkPut(toPlain(meals))
}
