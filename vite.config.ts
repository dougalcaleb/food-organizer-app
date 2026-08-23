import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from the root of a CloudFront distribution (see `infra/hosting.yaml`),
// so assets sit at '/'. This was '/food-organizer-app/' when the target was
// GitHub Pages; change it again only if the app moves under a path prefix.
const BASE = '/'

export default defineConfig({
	base: BASE,
	plugins: [
		vue(),
		tailwindcss(),
		/*
		Without a manifest declaring `display: standalone` plus a >=192px icon,
		Chrome offers only a bookmark shortcut that opens in a browser tab — which
		is what shipping without this looked like, and it reads as a broken
		install rather than a missing feature.

		`autoUpdate`: there is one user and no release ritual, so a prompt to
		reload would be pure friction. The service worker only ever caches build
		output; app data lives in IndexedDB and is untouched by an update.
		*/
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			// Fonts are the bulk of the payload and are what makes a cold offline
			// launch look right, so they are precached with everything else.
			workbox: {
				globPatterns: ['**/*.{js,css,html,woff2}'],
			},
			manifest: {
				id: '/',
				name: 'Pantry',
				short_name: 'Pantry',
				description: 'Meal ideas, a rolling plan, and the shopping list they imply.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'portrait',
				// Matches --color-gray-1, so the splash and status bar do not flash a
				// different dark than the app's own background.
				background_color: '#1a1a1a',
				theme_color: '#1a1a1a',
				icons: [
					{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		// `npm run dev -- --host` to reach it from a phone on the same network.
		port: 5173,
	},
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.spec.ts'],
	},
})
