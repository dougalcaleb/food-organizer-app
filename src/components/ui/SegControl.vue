<script setup lang="ts" generic="T extends string">
/*
The full-width segmented control from the handoff (BY STORE / BY MEAL / ALL).
Generic over the option id so callers keep their union types rather than
widening to string.
*/
defineProps<{
	options: readonly { id: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
	<div class="seg" role="tablist">
		<button
			v-for="opt in options"
			:key="opt.id"
			type="button"
			role="tab"
			class="seg-opt"
			:class="{ 'seg-opt-active': model === opt.id }"
			:aria-selected="model === opt.id"
			@click="model = opt.id"
		>
			{{ opt.label }}
		</button>
	</div>
</template>
