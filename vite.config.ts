import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Served from https://<user>.github.io/food-organizer-app/, so every emitted
// asset URL needs the repo name prefixed. Change this if a custom domain or a
// different host is ever used.
const BASE = '/food-organizer-app/'

export default defineConfig({
	base: BASE,
	plugins: [vue(), tailwindcss()],
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
