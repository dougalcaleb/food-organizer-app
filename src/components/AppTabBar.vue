<script setup lang="ts">
/*
The three-tab bottom bar. Label plus an active indicator riding the top border —
no counts.

`safe-bottom` carries the bar's bottom padding; the tabs supply their own
vertical padding, so the two never touch the same property.
*/
const tabs = [
	{ to: '/list', label: 'List' },
	{ to: '/ideas', label: 'Ideas' },
	{ to: '/plan', label: 'Plan' },
]
</script>

<template>
	<nav
		class="safe-bottom z-chrome flex flex-none border-t border-border bg-surface px-2 [--safe-bottom-base:0.5rem]"
	>
		<RouterLink
			v-for="tab in tabs"
			:key="tab.to"
			v-slot="{ isActive }"
			:to="tab.to"
			class="relative flex flex-1 items-center justify-center py-3.5"
		>
			<span
				class="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-b-full transition-colors"
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
