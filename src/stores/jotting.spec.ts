/*
The app has to survive being used at its laziest: a name typed in a hurry and
nothing else. These lock in that a bare idea is a first-class record rather
than a half-broken one.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateStores } from '@/stores'
import { useListStore } from '@/stores/list'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import { lastMadeLabel, weeksSince } from '@/lib/dates'

beforeEach(async () => {
	setActivePinia(createPinia())
	await hydrateStores()
})

describe('jotting down a bare idea', () => {
	it('accepts a meal with nothing but a name', async () => {
		const meal = await useMealsStore().create({ name: 'that thai place thing' })

		expect(meal.tags).toEqual([])
		expect(meal.ingredients).toEqual([])
		expect(meal.notes).toBe('')
		expect(meal.lastMadeAt).toBeNull()
	})

	it('sorts a never-made meal as maximally stale, so it resurfaces', async () => {
		const meal = await useMealsStore().create({ name: 'bare idea' })

		expect(lastMadeLabel(meal.lastMadeAt)).toBe('never made')
		expect(weeksSince(meal.lastMadeAt)).toBe(Infinity)
	})

	it('can be planned with no ingredients, contributing nothing to buy', async () => {
		const meal = await useMealsStore().create({ name: 'bare idea' })
		await usePlanStore().add(meal.id)

		expect(usePlanStore().plannedMeals.map((m) => m.name)).toContain('bare idea')
		expect(useListStore().items).toHaveLength(0)
	})

	it('accepts an ingredient that is only a name', async () => {
		const meal = await useMealsStore().create({
			name: 'bare idea',
			ingredients: [{ name: 'olive oil' }],
		})
		await usePlanStore().add(meal.id)

		// Planning alone buys nothing; pulling the meal onto the list is what
		// does. A half-written idea has to survive that trip intact too.
		expect(useListStore().items).toHaveLength(0)
		await usePlanStore().pullAll(meal)

		const item = useListStore().items[0]
		expect(item.name).toBe('olive oil')
		expect(item.qty).toBe('')
		expect(item.store).toBe('wherever')
	})

	it('survives a reload with all the gaps intact', async () => {
		const meal = await useMealsStore().create({
			name: 'bare idea',
			ingredients: [{ name: 'olive oil' }],
		})

		setActivePinia(createPinia())
		await hydrateStores()

		const reloaded = useMealsStore().get(meal.id)!
		expect(reloaded.ingredients[0]).toEqual({ name: 'olive oil' })
		expect(reloaded.lastMadeAt).toBeNull()
	})

	it('takes a one-off with just a name, defaulting quantity and staying a one-off', async () => {
		const list = useListStore()
		const extra = await list.addExtra('paper towels', 'wherever')

		expect(extra?.qty).toBe('1')
		expect(extra?.kind).toBe('oneoff')
		expect(extra?.active).toBe(true)
	})
})
