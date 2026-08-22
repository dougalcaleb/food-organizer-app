import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import '@/styles/main.css'
import '@/plugins/fontawesome'
import { router } from '@/router'
import { requestPersistentStorage } from '@/lib/storage'
import App from '@/App.vue'

async function bootstrap() {
	// Ask the browser not to evict our IndexedDB under storage pressure. This is
	// the only copy of the user's data, so it matters; it is also best-effort and
	// unsupported in some browsers, hence the guard inside.
	void requestPersistentStorage()

	// TODO(step 3): hydrate the Pinia stores from Dexie here, awaited, so the
	// first paint already has real data instead of flashing empty states.

	const app = createApp(App)
	app.use(createPinia())
	app.use(router)
	app.component('FaIcon', FontAwesomeIcon)

	await router.isReady()
	app.mount('#app')
}

void bootstrap()
