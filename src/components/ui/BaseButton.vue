<script setup lang="ts">
/*
Wraps the `.btn` classes so call sites pick a variant instead of remembering
class combinations. Renders as a <button> by default, or a <RouterLink> when
`to` is given.
*/
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
		/** Square, icon-only. Still meets the 44px tap target. */
		icon?: boolean
		block?: boolean
		disabled?: boolean
		type?: 'button' | 'submit'
		to?: RouteLocationRaw
	}>(),
	{
		variant: 'secondary',
		icon: false,
		block: false,
		disabled: false,
		type: 'button',
		to: undefined,
	},
)

const classes = computed(() => [
	'btn',
	`btn-${props.variant}`,
	{ 'btn-icon': props.icon, 'w-full': props.block },
])
</script>

<template>
	<RouterLink v-if="to" :to="to" :class="classes">
		<slot />
	</RouterLink>
	<button v-else :type="type" :disabled="disabled" :class="classes">
		<slot />
	</button>
</template>
