import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSettings, saveSettings } from '@/db/repositories/settings'
import { DEFAULT_SETTINGS, type Settings } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
	const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

	async function hydrate() {
		settings.value = await loadSettings()
	}

	/** Patch one or more fields and write through immediately. */
	async function update(patch: Partial<Omit<Settings, 'id' | 'schemaVersion'>>) {
		settings.value = { ...settings.value, ...patch }
		await saveSettings(settings.value)
	}

	return { settings, hydrate, update }
})
