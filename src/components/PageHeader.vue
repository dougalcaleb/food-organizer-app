<script setup lang="ts">
/*
The per-tab header from the handoff: an accent kicker, the big title, and a
right-aligned meta line. The gear opens settings — the tab bar stays at three,
so settings lives here.
*/
defineProps<{
	kicker: string
	title: string
	meta?: string
}>()
</script>

<template>
	<header class="safe-top flex items-end justify-between gap-2.5 px-4 pt-4 pb-2">
		<div class="min-w-0">
			<p class="text-micro tracking-[0.14em] text-accent uppercase">{{ kicker }}</p>
			<h1 class="mt-0.5 text-page-title tracking-[-0.01em]">{{ title }}</h1>
		</div>

		<div class="flex flex-none items-center gap-1">
			<p v-if="meta" class="pb-1.5 text-right text-meta tracking-[0.06em] text-subtle uppercase">
				{{ meta }}
			</p>
			<button type="button" class="btn btn-ghost btn-icon text-subtle" aria-label="Settings">
				<FaIcon icon="gear" />
			</button>
		</div>
	</header>
</template>
