/*
Guards the sheet registry.

`useSheet` accepts a fixed set of sheet names; AppSheets is what actually
renders them. When those two drift, the failure is silent and confusing: the
URL changes, a history entry is pushed, and nothing appears on screen — which
is exactly what happened when the meal detail sheet was still unbuilt.

So: every name in SHEET_NAMES must render something.

It also guards the other half of the contract: a sheet stays mounted for its
exit animation after `?sheet=` clears. Unmounting on the query change is what
made every sheet fade in and then vanish.
*/
import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSheets from '@/components/AppSheets.vue'
import SettingsSheet from '@/components/SettingsSheet.vue'
import { SHEET_EXIT_MS, SHEET_NAMES } from '@/composables/useSheet'
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

	it('runs the entrance animation on a sheet that mounts already open', async () => {
		const router = makeRouter()
		await router.push({ path: '/ideas', query: { sheet: 'settings' } })
		await router.isReady()

		// Test Utils stubs transitions by default, which would hide the very thing
		// under test here.
		mount(AppSheets, { global: { plugins: [router], stubs: { transition: false } } })
		await flushPromises()

		// A sheet is mounted already open, and without `appear` a Transition skips
		// the enter on its first render — the sheet would simply be there, having
		// never risen.
		const sheet = document.body.querySelector('[role="dialog"]')?.parentElement

		expect(sheet?.className).toContain('sheet-enter-active')
	})

	it('keeps a closed sheet mounted for its exit animation, then drops it', async () => {
		const router = makeRouter()
		await router.push({ path: '/ideas', query: { sheet: 'settings' } })
		await router.isReady()

		const wrapper = mount(AppSheets, { global: { plugins: [router] } })
		await flushPromises()
		expect(wrapper.findComponent(SettingsSheet).exists()).toBe(true)

		// The back gesture clears the query well before the sheet is off screen.
		await router.push('/ideas')
		await flushPromises()
		expect(wrapper.findComponent(SettingsSheet).exists()).toBe(true)

		// Generously past the exit plus the small unmount buffer AppSheets adds.
		await new Promise((resolve) => setTimeout(resolve, SHEET_EXIT_MS + 150))
		await flushPromises()
		expect(wrapper.findComponent(SettingsSheet).exists()).toBe(false)
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
