import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import '@/styles/main.css'
import '@/plugins/fontawesome'
import { router } from '@/router'
import { requestPersistentStorage } from '@/lib/storage'
import { runCloudBackupOnLaunch } from '@/composables/useCloudBackup'
import { hydrateStores } from '@/stores'
import App from '@/App.vue'

async function bootstrap() {
	// Ask the browser not to evict our IndexedDB under storage pressure. This is
	// the user's only copy of their data, so it matters — but it is best-effort
	// and unsupported in some browsers, so nothing waits on it.
	void requestPersistentStorage()

	const pinia = createPinia()
	// Explicit, because the stores below are used before any component mounts.
	setActivePinia(pinia)

	// Dev builds start from the design prototype's 14 sample meals so there is
	// something real on screen; production starts empty on purpose.
	if (import.meta.env.DEV) {
		const { seedIfEmpty } = await import('@/db/seed')
		await seedIfEmpty()
	}

	// Awaited, so the first paint has real data rather than flashing empty states.
	await hydrateStores()

	const app = createApp(App)
	app.use(pinia)
	app.use(router)
	app.component('FaIcon', FontAwesomeIcon)

	await router.isReady()
	app.mount('#app')

	// Fire-and-forget, after mount and after hydration: a weekly backup is never
	// worth delaying first paint for, and it reads the database it is backing up.
	void runCloudBackupOnLaunch()
}

void bootstrap()
