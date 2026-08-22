import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSheet } from './useSheet'

/** Mounts a throwaway component so the composable has a router context. */
async function withSheet(initialUrl = '/list') {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/list', component: { template: '<div />' } },
			{ path: '/ideas', component: { template: '<div />' } },
		],
	})

	let api!: ReturnType<typeof useSheet>

	const Host = defineComponent({
		setup() {
			api = useSheet()
			return () => null
		},
	})

	await router.push(initialUrl)
	await router.isReady()
	mount(Host, { global: { plugins: [router] } })

	return { api, router }
}

describe('useSheet', () => {
	it('reports no sheet on a plain route', async () => {
		const { api } = await withSheet('/list')
		expect(api.current.value).toBeNull()
		expect(api.isOpen.value).toBe(false)
	})

	it('reads the sheet name and id out of the query', async () => {
		const { api } = await withSheet('/list?sheet=meal&id=curry')
		expect(api.current.value).toBe('meal')
		expect(api.id.value).toBe('curry')
		expect(api.isOpen.value).toBe(true)
	})

	it('ignores an unrecognised sheet name rather than opening something', async () => {
		const { api } = await withSheet('/list?sheet=bogus')
		expect(api.current.value).toBeNull()
		expect(api.isOpen.value).toBe(false)
	})

	it('opens a sheet by pushing it into the query', async () => {
		const { api, router } = await withSheet('/list')

		await api.open('settings')

		expect(router.currentRoute.value.query.sheet).toBe('settings')
		expect(api.current.value).toBe('settings')
	})

	it('keeps the current route when opening a sheet', async () => {
		const { api, router } = await withSheet('/ideas')

		await api.open('meal', 'curry')

		expect(router.currentRoute.value.path).toBe('/ideas')
		expect(router.currentRoute.value.query.id).toBe('curry')
	})

	it('preserves unrelated query params', async () => {
		const { api, router } = await withSheet('/ideas?q=curry')

		await api.open('settings')

		expect(router.currentRoute.value.query.q).toBe('curry')
	})

	it('clears the id when opening a sheet without one', async () => {
		const { api, router } = await withSheet('/list?sheet=meal&id=curry')

		await api.open('settings')

		expect(router.currentRoute.value.query.id).toBeUndefined()
	})

	it('closes by dropping sheet and id from the query', async () => {
		const { api, router } = await withSheet('/ideas?q=curry&sheet=meal&id=curry')

		await api.close()

		expect(router.currentRoute.value.query.sheet).toBeUndefined()
		expect(router.currentRoute.value.query.id).toBeUndefined()
		// Unrelated state survives — closing a sheet must not reset the search.
		expect(router.currentRoute.value.query.q).toBe('curry')
	})

	it('exposes a writable model that closes on false', async () => {
		const { api } = await withSheet('/list?sheet=settings')
		const model = api.openModel('settings')

		expect(model.value).toBe(true)

		model.value = false
		await flushPromises()

		expect(api.current.value).toBeNull()
	})

	it('does not close a different sheet through the wrong model', async () => {
		const { api } = await withSheet('/list?sheet=meal&id=curry')
		const settingsModel = api.openModel('settings')

		expect(settingsModel.value).toBe(false)

		settingsModel.value = false
		await flushPromises()

		// The meal sheet is still open — the settings model has no business closing it.
		expect(api.current.value).toBe('meal')
	})
})
