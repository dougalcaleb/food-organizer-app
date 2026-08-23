<script setup lang="ts">
/*
The three-tab bottom bar. Icon, label, and an active indicator riding the top
border — no counts.

`safe-bottom` carries the bar's bottom padding; the tabs are sized by height,
so the two never touch the same property. Both come from the `--tab-bar-*`
variables in `styles/base.css`, because the floating button on Ideas is `fixed`
and has to clear this bar without measuring it.

The label is `leading-none` for optical centering, and that is the whole reason
it is there. Inheriting the body's 1.55 gives an 11px uppercase label a ~17px
line box, and the ~5px of that box sitting below the baseline is space no glyph
in "LIST" ever occupies — so the tab row was mathematically centered while
carrying about 5px more empty space under the words than over the icon, and
read as sitting high. Collapsing the box to the text drops the group ~2px and
balances it. `gap-1.5` restores the icon-to-label gap the half-leading was
providing.
*/
const tabs = [
	{ to: '/list', label: 'List', icon: 'cart-shopping' },
	{ to: '/ideas', label: 'Ideas', icon: 'lightbulb' },
	{ to: '/plan', label: 'Plan', icon: 'utensils' },
]
</script>

<template>
	<nav
		class="safe-bottom z-chrome flex flex-none border-t border-border bg-surface px-2 [--safe-bottom-base:var(--tab-bar-base)]"
	>
		<RouterLink
			v-for="tab in tabs"
			:key="tab.to"
			v-slot="{ isActive }"
			:to="tab.to"
			class="relative flex h-[var(--tab-bar-height)] flex-1 flex-col items-center justify-center gap-1.5"
		>
			<span
				class="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-b-full transition-colors"
				:class="isActive ? 'bg-accent' : 'bg-transparent'"
			/>
			<FaIcon
				:icon="tab.icon"
				class="text-[15px] transition-colors"
				:class="isActive ? 'text-accent' : 'text-subtle'"
			/>
			<span
				class="font-heading text-[11px] leading-none font-semibold tracking-[0.09em] uppercase transition-colors"
				:class="isActive ? 'text-content' : 'text-subtle'"
			>
				{{ tab.label }}
			</span>
		</RouterLink>
	</nav>
</template>
