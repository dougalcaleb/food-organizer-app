/*
Guards the sheet registry.

`useSheet` accepts a fixed set of sheet names; AppSheets is what actually
renders them. When those two drift, the failure is silent and confusing: the
URL changes, a history entry is pushed, and nothing appears on screen — which
is exactly what happened when the meal detail sheet was still unbuilt.

So: every name in SHEET_NAMES must render something.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSheets from '@/components/AppSheets.vue'
import { SHEET_NAMES } from '@/composables/useSheet'
import { hydrateStores } from '@/stores'
import { useMealsStore } from '@/stores/meals'

function makeRouter() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/ideas', component: { template: '<div />' } }],
	})
}

let mealId: string

beforeEach(async () => {
	setActivePinia(createPinia())
	await hydrateStores()
	mealId = (await useMealsStore().create({ name: 'Weeknight red curry' })).id
})

afterEach(() => {
	document.body.innerHTML = ''
})

describe('sheet registry', () => {
	it.each(SHEET_NAMES)('renders a dialog for ?sheet=%s', async (sheet) => {
		const router = makeRouter()
		await router.push({ path: '/ideas', query: { sheet, id: mealId } })
		await router.isReady()

		mount(AppSheets, { global: { plugins: [router] } })
		await flushPromises()

		expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
	})

	it('renders nothing when no sheet is requested', async () => {
		const router = makeRouter()
		await router.push('/ideas')
		await router.isReady()

		mount(AppSheets, { global: { plugins: [router] } })
		await flushPromises()

		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
	})

	it('closes itself rather than hanging open on a stale meal id', async () => {
		const router = makeRouter()
		await router.push({ path: '/ideas', query: { sheet: 'meal', id: 'deleted-meal' } })
		await router.isReady()

		mount(AppSheets, { global: { plugins: [router] } })
		await flushPromises()

		expect(document.body.querySelector('[role="dialog"]')).toBeNull()
		expect(router.currentRoute.value.query.sheet).toBeUndefined()
	})
})
