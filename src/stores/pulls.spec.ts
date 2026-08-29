/*
Pulling a planned meal's ingredients onto the shopping list.

The rule this file exists to hold down: being planned buys nothing. A meal sits
in the plan for as long as it is still a meal you mean to cook, which is
routinely longer than the gap between shopping trips — so a list derived from
the plan alone re-buys the same chicken thighs every week. A pull is the record
of what was actually put on the list, and buying it takes the pull away.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { hydrateStores } from '@/stores'
import { useListStore } from '@/stores/list'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import type { Meal } from '@/types'

async function wipe() {
	await Promise.all([
		db.meals.clear(),
		db.plan.clear(),
		db.pulls.clear(),
		db.extras.clear(),
		db.checked.clear(),
		db.settings.clear(),
	])
}

beforeEach(async () => {
	setActivePinia(createPinia())
	await wipe()
	await hydrateStores()
})

/** A planned meal with two ingredients, which is enough for every case here. */
async function plannedCurry(): Promise<Meal> {
	const meal = await useMealsStore().create({
		name: 'Curry',
		ingredients: [
			{ name: 'coconut milk', amount: 2, unit: 'cans', store: 'costco' },
			{ name: 'chicken thighs', amount: 1.5, unit: 'lb', store: 'costco' },
		],
	})

	await usePlanStore().add(meal.id)
	return meal
}

describe('pulling a meal onto the list', () => {
	it('a planned meal contributes nothing until it is pulled', async () => {
		await plannedCurry()
		expect(useListStore().items).toEqual([])
	})

	it('one tap takes everything the meal needs', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)

		expect(useListStore().items.map((i) => i.name)).toEqual(['chicken thighs', 'coconut milk'])
	})

	it('takes them all back off again', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await usePlanStore().dropPull(meal.id)

		expect(useListStore().items).toEqual([])
		expect(await db.pulls.get(meal.id)).toBeUndefined()
	})

	it('picks a single ingredient without the rest', async () => {
		const meal = await plannedCurry()
		await usePlanStore().togglePulled(meal.id, 'coconut milk')

		expect(useListStore().items.map((i) => i.name)).toEqual(['coconut milk'])
		expect(usePlanStore().isPulled(meal.id, 'coconut milk')).toBe(true)
		expect(usePlanStore().isPulled(meal.id, 'chicken thighs')).toBe(false)
	})

	it('unticking the last one deletes the record rather than storing an empty one', async () => {
		const meal = await plannedCurry()
		await usePlanStore().togglePulled(meal.id, 'coconut milk')
		await usePlanStore().togglePulled(meal.id, 'coconut milk')

		expect(await db.pulls.get(meal.id)).toBeUndefined()
		expect(usePlanStore().pulls).toEqual([])
	})

	it('matches on the normalized name, so re-casing an ingredient keeps its pull', async () => {
		const meal = await plannedCurry()
		await usePlanStore().togglePulled(meal.id, 'Coconut Milk')

		expect(usePlanStore().isPulled(meal.id, 'coconut milk')).toBe(true)
		expect(useListStore().items.map((i) => i.name)).toEqual(['coconut milk'])
	})

	it('survives a reload', async () => {
		const meal = await plannedCurry()
		await usePlanStore().togglePulled(meal.id, 'coconut milk')

		setActivePinia(createPinia())
		await hydrateStores()

		expect(useListStore().items.map((i) => i.name)).toEqual(['coconut milk'])
	})
})

describe('a meal leaving the plan', () => {
	it('takes its pull with it', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await usePlanStore().remove(meal.id)

		expect(useListStore().items).toEqual([])
		expect(await db.pulls.get(meal.id)).toBeUndefined()
	})

	/*
	Otherwise re-planning a meal would silently put ingredients nobody asked for
	back on the list — the pull record would have outlived the plan entry that
	justified it.
	*/
	it('does not bring the old pull back when it is planned again', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await usePlanStore().remove(meal.id)
		await usePlanStore().add(meal.id)

		expect(useListStore().items).toEqual([])
	})

	it('goes the same way for "Made it"', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await usePlanStore().markMade(meal.id)

		expect(await db.pulls.get(meal.id)).toBeUndefined()
		expect(useMealsStore().get(meal.id)?.lastMadeAt).toBeTypeOf('number')
	})

	it('goes with an archived meal too', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await useMealsStore().remove(meal.id)

		expect(await db.pulls.get(meal.id)).toBeUndefined()
	})
})

describe('finishing a trip', () => {
	it('releases only what was bought', async () => {
		const meal = await plannedCurry()
		const plan = usePlanStore()
		const list = useListStore()

		await plan.pullAll(meal)
		await list.toggle('coconut milk')
		await list.clearCart()

		expect(plan.pulledNames(meal.id)).toEqual(['chicken thighs'])
		expect(list.items.map((i) => i.name)).toEqual(['chicken thighs'])
	})

	it('releases an ingredient from every meal that asked for it', async () => {
		const meals = useMealsStore()
		const plan = usePlanStore()
		const list = useListStore()

		const curry = await plannedCurry()
		const chili = await meals.create({
			name: 'Chili',
			ingredients: [{ name: 'coconut milk', amount: 1, unit: 'cans' }],
		})
		await plan.add(chili.id)

		await plan.pullAll(curry)
		await plan.pullAll(chili)
		await list.toggle('coconut milk')
		await list.clearCart()

		expect(plan.pulledNames(curry.id)).toEqual(['chicken thighs'])
		expect(plan.pulledNames(chili.id)).toEqual([])
		expect(await db.pulls.get(chili.id)).toBeUndefined()
	})

	it('leaves the meal planned, so it can be pulled again next week', async () => {
		const meal = await plannedCurry()
		const plan = usePlanStore()
		const list = useListStore()

		await plan.pullAll(meal)
		await list.toggle('coconut milk')
		await list.toggle('chicken thighs')
		await list.clearCart()

		expect(list.items).toEqual([])
		expect(plan.mealIds).toContain(meal.id)

		await plan.pullAll(meal)
		expect(list.items).toHaveLength(2)
	})
})

/*
A checked key outlives its row whenever an ingredient stops being derived while
it is in the cart. That is invisible at the time — the cart is the item list
filtered by the checked set, and the item is gone — and wrong the next time
anything derives the same name, because the row comes back already checked off.
In a shop that means walking straight past it.
*/
describe('orphaned checked keys', () => {
	it('are swept when a pulled ingredient is taken back off the list', async () => {
		const meal = await plannedCurry()
		const plan = usePlanStore()
		const list = useListStore()

		await plan.pullAll(meal)
		await list.toggle('coconut milk')

		await plan.dropPull(meal.id)
		await list.clearOrphanedChecked()

		expect(list.checked.size).toBe(0)
		expect(await db.checked.count()).toBe(0)

		// The proof that matters: it comes back unchecked.
		await plan.pullAll(meal)
		expect(list.openItems.map((i) => i.name)).toContain('coconut milk')
		expect(list.doneItems).toEqual([])
	})

	it('are swept at launch, for anything changed outside the List view', async () => {
		const meal = await plannedCurry()
		await usePlanStore().pullAll(meal)
		await useListStore().toggle('coconut milk')

		// Unplanned on the Plan tab, which never touches the checked keys.
		await usePlanStore().remove(meal.id)

		setActivePinia(createPinia())
		await hydrateStores()

		expect(await db.checked.count()).toBe(0)
	})

	it('never sweeps a key whose item is genuinely on the list', async () => {
		const meal = await plannedCurry()
		const list = useListStore()

		await usePlanStore().pullAll(meal)
		await list.toggle('coconut milk')
		await list.clearOrphanedChecked()

		expect(list.doneItems.map((i) => i.name)).toEqual(['coconut milk'])
		expect(await db.checked.count()).toBe(1)
	})
})
