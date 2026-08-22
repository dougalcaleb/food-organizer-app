<script setup lang="ts">
/*
The per-tab header: the title, a right-aligned meta line, and the gear.
Settings lives here so the tab bar can stay at three.

`safe-top` already carries the header's top padding — do not add a `pt-*`
alongside it, they collide.
*/
import BaseButton from '@/components/ui/BaseButton.vue'
import { useSheet } from '@/composables/useSheet'

defineProps<{
	title: string
	meta?: string
}>()

const { open } = useSheet()
</script>

<template>
	<header class="safe-top flex items-center justify-between gap-3 px-4 pb-3">
		<h1 class="min-w-0 flex-1 text-page-title leading-none tracking-[-0.01em]">{{ title }}</h1>

		<div class="flex flex-none items-center gap-2">
			<p v-if="meta" class="text-meta tracking-[0.06em] text-subtle uppercase">{{ meta }}</p>

			<!-- Negative margin keeps the 44px tap target while letting the icon sit
			     optically flush with the page margin. -->
			<BaseButton
				variant="ghost"
				icon
				class="-mr-2.5 text-subtle"
				aria-label="Settings"
				@click="open('settings')"
			>
				<FaIcon icon="gear" />
			</BaseButton>
		</div>
	</header>
</template>
