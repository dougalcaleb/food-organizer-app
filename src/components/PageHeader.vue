<script setup lang="ts">
/*
The per-tab header: the title, the meta line beneath it, and the gear.
Settings lives here so the tab bar can stay at three.

The meta sits *under* the title rather than beside it: on a narrow phone the
two together left "Shopping list" too little room and it wrapped.

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
	<header class="safe-top flex items-start justify-between gap-3 px-4 pb-3">
		<div class="min-w-0 flex-1">
			<h1 class="whitespace-nowrap text-page-title leading-none tracking-[-0.01em]">{{ title }}</h1>
			<p v-if="meta" class="mt-1.5 text-meta tracking-[0.06em] text-subtle uppercase">
				{{ meta }}
			</p>
		</div>

		<!-- Aligned to the title line, not to the middle of title-plus-meta. The
		     negative margins keep the 44px tap target while letting the icon sit
		     optically flush with the page margin and level with the title. -->
		<BaseButton
			variant="ghost"
			icon
			class="-mt-1.5 -mr-2.5 flex-none text-subtle"
			aria-label="Settings"
			@click="open('settings')"
		>
			<FaIcon icon="gear" />
		</BaseButton>
	</header>
</template>
