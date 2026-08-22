<script setup lang="ts">
/*
The app shell. Fixed header, one scrolling content area, fixed tab bar — the
handoff is explicit that vertical scroll lives in exactly one container.
*/
import AppTabBar from '@/components/AppTabBar.vue'
</script>

<template>
	<div class="flex h-dvh flex-col overflow-hidden bg-bg text-content">
		<main class="min-h-0 flex-1 overflow-y-auto">
			<RouterView />
		</main>

		<AppTabBar />
	</div>
</template>
