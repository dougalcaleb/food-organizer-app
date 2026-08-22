<script setup lang="ts">
/*
The three-tab bottom bar. Counts are placeholders until the stores land in
step 3 — the shape (indicator bar / label / live count) is what matters here.
*/
const tabs = [
	{ to: '/list', label: 'List', count: '0 items' },
	{ to: '/ideas', label: 'Ideas', count: '0 saved' },
	{ to: '/plan', label: 'Plan', count: '0 meals' },
]
</script>

<template>
	<nav class="safe-bottom z-chrome flex flex-none border-t border-border bg-surface px-1.5">
		<RouterLink
			v-for="tab in tabs"
			:key="tab.to"
			v-slot="{ isActive }"
			:to="tab.to"
			class="flex flex-1 flex-col items-center gap-1.5 pt-3 pb-1.5"
		>
			<span
				class="h-0.5 w-[22px] rounded-full transition-colors"
				:class="isActive ? 'bg-accent' : 'bg-transparent'"
			/>
			<span
				class="font-heading text-[13px] font-semibold tracking-[0.09em] uppercase transition-colors"
				:class="isActive ? 'text-content' : 'text-subtle'"
			>
				{{ tab.label }}
			</span>
			<span
				class="text-micro tracking-[0.04em] transition-colors"
				:class="isActive ? 'text-accent' : 'text-faint'"
			>
				{{ tab.count }}
			</span>
		</RouterLink>
	</nav>
</template>
