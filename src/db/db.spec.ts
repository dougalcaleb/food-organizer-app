/*
Exercises the persistence layer against a real (in-memory) IndexedDB, so the
Dexie schema, the repositories, and store hydration are covered rather than
just the pure logic above them.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db'
import { reseed, seedIfEmpty } from '@/db/seed'
import { exportBackup, restoreBackup, BackupFormatError } from '@/db/backup'
import { hydrateStores } from '@/stores'
import { useListStore } from '@/stores/list'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import { useSettingsStore } from '@/stores/settings'

async function wipe() {
	await Promise.all([
		db.meals.clear(),
		db.extras.clear(),
		db.plan.clear(),
		db.checked.clear(),
		db.settings.clear(),
	])
}

beforeEach(async () => {
	setActivePinia(createPinia())
	await wipe()
})

describe('seeding', () => {
	it('populates an empty database with the prototype meals', async () => {
		expect(await seedIfEmpty()).toBe(true)
		expect(await db.meals.count()).toBe(14)
		expect(await db.plan.count()).toBe(3)
		expect(await db.extras.count()).toBe(6)
	})

	it('does not clobber existing data', async () => {
		await seedIfEmpty()
		await db.meals.delete('curry')

		expect(await seedIfEmpty()).toBe(false)
		expect(await db.meals.count()).toBe(13)
	})

	it('converts weeksAgo into a real lastMadeAt timestamp', async () => {
		await reseed()
		const curry = await db.meals.get('curry')

		expect(curry?.lastMadeAt).toBeTypeOf('number')
		// The prototype had this one at 2 weeks ago.
		const weeks = (Date.now() - curry!.lastMadeAt!) / (7 * 24 * 60 * 60 * 1000)
		expect(Math.round(weeks)).toBe(2)
	})
})

describe('hydration', () => {
	it('loads every store from disk', async () => {
		await reseed()
		await hydrateStores()

		expect(useMealsStore().meals).toHaveLength(14)
		expect(usePlanStore().mealIds).toEqual(['curry', 'sausage', 'greek'])
		expect(useListStore().extras).toHaveLength(6)
		expect(useSettingsStore().settings.staleWeeks).toBe(12)
	})

	it('writes default settings on first run', async () => {
		await useSettingsStore().hydrate()
		expect(await db.settings.get('app')).toMatchObject({ staleWeeks: 12 })
	})

	it('derives a shopping list from the seeded plan', async () => {
		await reseed()
		await hydrateStores()

		const list = useListStore()
		expect(list.items.length).toBeGreaterThan(0)
		// Only the two active extras reach the list; the shelved staples do not.
		expect(list.items.filter((i) => i.isExtra)).toHaveLength(2)
		expect(list.shelvedStaples).toHaveLength(4)
	})
})

describe('write-through persistence', () => {
	it('survives a round trip through the database', async () => {
		await hydrateStores()
		const meals = useMealsStore()

		const created = await meals.create({
			name: 'Test soup',
			tags: ['Quick'],
			ingredients: [{ name: 'broth', amount: 2, unit: 'cans', store: 'costco' }],
		})

		// Re-hydrate a fresh store from disk.
		setActivePinia(createPinia())
		await hydrateStores()

		const reloaded = useMealsStore().get(created.id)
		expect(reloaded?.name).toBe('Test soup')
		expect(reloaded?.ingredients[0].name).toBe('broth')
	})

	it('persists check-offs and returns items to the open list when unchecked', async () => {
		await reseed()
		await hydrateStores()

		const list = useListStore()
		const key = list.openItems[0].key
		await list.toggle(key)

		expect(list.doneItems.map((i) => i.key)).toContain(key)
		expect(await db.checked.get(key)).toBeTruthy()

		await list.toggle(key)
		expect(await db.checked.get(key)).toBeUndefined()
		expect(list.openItems.map((i) => i.key)).toContain(key)
	})

	it('drops a meal from the plan when it is deleted', async () => {
		await reseed()
		await hydrateStores()

		await useMealsStore().remove('curry')
		expect(await db.plan.get('curry')).toBeUndefined()

		// Soft delete: the record is kept, just archived.
		expect(await db.meals.get('curry')).toMatchObject({ archived: true })
	})

	it('archived meals stay out of the rehydrated list', async () => {
		await reseed()
		await hydrateStores()
		await useMealsStore().remove('curry')

		setActivePinia(createPinia())
		await hydrateStores()
		expect(useMealsStore().get('curry')).toBeUndefined()
	})
})

describe('made it', () => {
	it('removes from the plan and stamps last-made', async () => {
		await reseed()
		await hydrateStores()

		const before = useMealsStore().get('curry')!.lastMadeAt!
		await usePlanStore().markMade('curry')

		expect(usePlanStore().mealIds).not.toContain('curry')
		expect(useMealsStore().get('curry')!.lastMadeAt!).toBeGreaterThan(before)
	})

	it('plain removal does NOT touch last-made', async () => {
		await reseed()
		await hydrateStores()

		const before = useMealsStore().get('curry')!.lastMadeAt
		await usePlanStore().remove('curry')

		expect(usePlanStore().mealIds).not.toContain('curry')
		expect(useMealsStore().get('curry')!.lastMadeAt).toBe(before)
	})
})

describe('backup', () => {
	it('round-trips the whole database', async () => {
		await reseed()
		const backup = await exportBackup()

		await wipe()
		expect(await db.meals.count()).toBe(0)

		await restoreBackup(JSON.stringify(backup))
		expect(await db.meals.count()).toBe(14)
		expect(await db.plan.count()).toBe(3)
	})

	it('rejects a file that is not a backup, leaving data intact', async () => {
		await reseed()

		await expect(restoreBackup('{"hello":"world"}')).rejects.toThrow(BackupFormatError)
		await expect(restoreBackup('not json at all')).rejects.toThrow(BackupFormatError)
		expect(await db.meals.count()).toBe(14)
	})

	it('refuses a backup from a newer schema version', async () => {
		const backup = { ...(await exportBackup()), schemaVersion: 99 }
		await expect(restoreBackup(JSON.stringify(backup))).rejects.toThrow(/newer version/)
	})
})

describe('staples and one-offs', () => {
	it('keeps shelved staples off the shopping list', async () => {
		await reseed()
		await hydrateStores()

		const names = useListStore().items.map((i) => i.name)
		expect(names).toContain('coffee beans') // active staple
		expect(names).not.toContain('milk') // shelved
		expect(names).not.toContain('butter')
	})

	it('adds a shelved staple to the list without retyping it', async () => {
		await reseed()
		await hydrateStores()
		const list = useListStore()

		await list.setStapleActive('e3', true)

		expect(list.items.map((i) => i.name)).toContain('milk')
		expect(list.shelvedStaples.map((s) => s.id)).not.toContain('e3')
	})

	it('persists the shelf across a reload', async () => {
		await reseed()
		await hydrateStores()
		await useListStore().setStapleActive('e3', true)

		setActivePinia(createPinia())
		await hydrateStores()

		expect(useListStore().items.map((i) => i.name)).toContain('milk')
	})
})

describe('clearing the cart', () => {
	/** Check off one item of each kind, then report the plan. */
	async function checkOneOfEach() {
		await reseed()
		await hydrateStores()
		const list = useListStore()

		const ingredient = list.openItems.find((i) => !i.isExtra)!
		const oneOff = list.openItems.find((i) => i.extraKind === 'oneoff')!
		const staple = list.openItems.find((i) => i.extraKind === 'staple')!

		await list.toggle(ingredient.key)
		await list.toggle(oneOff.key)
		await list.toggle(staple.key)

		return { list, ingredient, oneOff, staple }
	}

	it('describes what it will do before doing it', async () => {
		const { list } = await checkOneOfEach()
		const plan = list.cartClearPlan

		expect(plan.oneOffsToDelete.map((i) => i.name)).toEqual(['paper towels'])
		expect(plan.staplesToShelve.map((i) => i.name)).toEqual(['coffee beans'])
		expect(plan.ingredientsToUncheck).toHaveLength(1)
	})

	it('deletes bought one-offs outright', async () => {
		const { list, oneOff } = await checkOneOfEach()
		await list.clearCart()

		expect(list.extras.map((e) => e.id)).not.toContain(oneOff.extraId)
		expect(await db.extras.get(oneOff.extraId!)).toBeUndefined()
	})

	it('returns bought staples to the shelf rather than deleting them', async () => {
		const { list, staple } = await checkOneOfEach()
		await list.clearCart()

		expect(await db.extras.get(staple.extraId!)).toMatchObject({ active: false })
		expect(list.shelvedStaples.map((s) => s.id)).toContain(staple.extraId)
		expect(list.items.map((i) => i.name)).not.toContain('coffee beans')
	})

	it('only unchecks meal ingredients, since the meal is still planned', async () => {
		const { list, ingredient } = await checkOneOfEach()
		await list.clearCart()

		expect(list.openItems.map((i) => i.key)).toContain(ingredient.key)
		expect(list.doneItems).toHaveLength(0)
	})

	it('leaves unchecked items completely alone', async () => {
		const { list } = await checkOneOfEach()
		const openBefore = list.openItems.length
		await list.clearCart()

		// Of the three checked items only the ingredient comes back: the one-off
		// was deleted and the staple went to the shelf.
		expect(list.openItems).toHaveLength(openBefore + 1)
	})

	it('uncheckAll is non-destructive', async () => {
		const { list, oneOff } = await checkOneOfEach()
		await list.uncheckAll()

		expect(list.doneItems).toHaveLength(0)
		expect(await db.extras.get(oneOff.extraId!)).toBeTruthy()
	})
})
