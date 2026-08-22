<script setup lang="ts">
/*
The three-tab bottom bar. Deliberately just the label and its active
indicator — no live counts.
*/
const tabs = [
	{ to: '/list', label: 'List' },
	{ to: '/ideas', label: 'Ideas' },
	{ to: '/plan', label: 'Plan' },
]
</script>

<template>
	<nav class="safe-bottom z-chrome flex flex-none border-t border-border bg-surface px-1.5">
		<RouterLink
			v-for="tab in tabs"
			:key="tab.to"
			v-slot="{ isActive }"
			:to="tab.to"
			class="flex flex-1 flex-col items-center gap-2 pt-3 pb-2"
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
		</RouterLink>
	</nav>
</template>
