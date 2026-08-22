import { describe, expect, it, vi, afterEach } from 'vitest'
import { requestPersistentStorage } from './storage'

describe('requestPersistentStorage', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns false when the browser has no storage manager', async () => {
		vi.stubGlobal('navigator', {})
		await expect(requestPersistentStorage()).resolves.toBe(false)
	})

	it('does not re-request when storage is already persisted', async () => {
		const persist = vi.fn()
		vi.stubGlobal('navigator', {
			storage: { persisted: async () => true, persist },
		})

		await expect(requestPersistentStorage()).resolves.toBe(true)
		expect(persist).not.toHaveBeenCalled()
	})

	it('requests persistence when not yet granted', async () => {
		vi.stubGlobal('navigator', {
			storage: { persisted: async () => false, persist: async () => true },
		})

		await expect(requestPersistentStorage()).resolves.toBe(true)
	})

	it('swallows a rejecting storage manager rather than breaking boot', async () => {
		vi.stubGlobal('navigator', {
			storage: {
				persisted: async () => {
					throw new Error('denied')
				},
				persist: async () => true,
			},
		})

		await expect(requestPersistentStorage()).resolves.toBe(false)
	})
})
