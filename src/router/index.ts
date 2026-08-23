import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/*
Hash history, deliberately. The original reason was that GitHub Pages has no
SPA rewrite; CloudFront now provides one (403/404 -> /index.html, see
`infra/hosting.yaml`), so path history would work. It is kept because hash
routing behaves correctly inside an installed PWA and needs no origin support
at all -- switching is a real decision, not a leftover.

Sheets (meal detail, meal editor, settings) are NOT routes — they live in the
query string so the phone's back gesture closes the sheet instead of leaving
the app. See `useSheet()`.
*/
const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: '/list' },
	{
		path: '/list',
		name: 'list',
		component: () => import('@/views/ListView.vue'),
	},
	{
		path: '/ideas',
		name: 'ideas',
		component: () => import('@/views/IdeasView.vue'),
	},
	{
		path: '/plan',
		name: 'plan',
		component: () => import('@/views/PlanView.vue'),
	},
]

if (import.meta.env.DEV) {
	routes.push({
		path: '/styleguide',
		name: 'styleguide',
		component: () => import('@/views/StyleguideView.vue'),
	})
}

export const router = createRouter({
	history: createWebHashHistory(import.meta.env.BASE_URL),
	routes,
})
