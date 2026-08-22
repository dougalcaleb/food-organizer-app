import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { allMeals, deleteMeal, putMeal } from '@/db/repositories/meals'
import type { Ingredient, Meal } from '@/types'

export const useMealsStore = defineStore('meals', () => {
	const meals = ref<Meal[]>([])

	const byId = computed(() => new Map(meals.value.map((m) => [m.id, m])))

	/** Every tag actually in use, alphabetical. */
	const usedTags = computed(() =>
		[...new Set(meals.value.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b)),
	)

	async function hydrate() {
		meals.value = await allMeals()
	}

	function get(id: string): Meal | undefined {
		return byId.value.get(id)
	}

	function sortInPlace() {
		meals.value.sort((a, b) => a.name.localeCompare(b.name))
	}

	async function create(input: {
		name: string
		tags?: string[]
		notes?: string
		ingredients?: Ingredient[]
	}): Promise<Meal> {
		const now = Date.now()
		const meal: Meal = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			tags: input.tags ?? [],
			notes: input.notes ?? '',
			lastMadeAt: null,
			ingredients: input.ingredients ?? [],
			createdAt: now,
			updatedAt: now,
			archived: false,
		}

		meals.value.push(meal)
		sortInPlace()
		await putMeal(meal)
		return meal
	}

	async function update(id: string, patch: Partial<Omit<Meal, 'id' | 'createdAt'>>) {
		const existing = get(id)
		if (!existing) return

		const updated: Meal = { ...existing, ...patch, updatedAt: Date.now() }
		meals.value.splice(meals.value.indexOf(existing), 1, updated)
		sortInPlace()
		await putMeal(updated)
	}

	/** Records that a meal was cooked. The only thing that writes last-made. */
	async function markMade(id: string, at: number = Date.now()) {
		await update(id, { lastMadeAt: at })
	}

	async function remove(id: string) {
		meals.value = meals.value.filter((m) => m.id !== id)
		await deleteMeal(id)
	}

	return { meals, usedTags, hydrate, get, create, update, markMade, remove }
})
