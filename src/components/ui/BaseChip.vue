<script setup lang="ts">
/*
Tag and store chips. `selectable` makes it a button (filter chips, store
picker); without it, it renders as a static label (the tags on a meal card).
*/
withDefaults(
	defineProps<{
		active?: boolean
		/** Muted, uppercase variant used for read-only tags on cards. */
		soft?: boolean
		selectable?: boolean
	}>(),
	{ active: false, soft: false, selectable: false },
)
</script>

<template>
	<button
		v-if="selectable"
		type="button"
		class="chip"
		:class="{ 'chip-active': active, 'chip-soft': soft && !active }"
		:aria-pressed="active"
	>
		<slot />
	</button>
	<span v-else class="chip" :class="{ 'chip-active': active, 'chip-soft': soft && !active }">
		<slot />
	</span>
</template>
