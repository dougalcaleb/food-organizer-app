/*
Globally registered components, declared so `vue-tsc` and editors can resolve
them in templates. Registered in main.ts.
*/
import type { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

declare module 'vue' {
	export interface GlobalComponents {
		FaIcon: typeof FontAwesomeIcon
	}
}

export {}
