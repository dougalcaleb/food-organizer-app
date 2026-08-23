<script setup lang="ts">
/*
Text input bound with v-model. Emits `submit` on Enter, which is how the
one-off item row and the meal editor both want to behave.
*/
const model = defineModel<string>({ required: true })

withDefaults(
	defineProps<{
		placeholder?: string
		type?: 'text' | 'number' | 'search'
		inputmode?: 'text' | 'decimal' | 'numeric' | 'search'
	}>(),
	{ placeholder: '', type: 'text', inputmode: 'text' },
)

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
	<input
		v-model="model"
		class="input"
		:type="type"
		:inputmode="inputmode"
		:placeholder="placeholder"
		autocomplete="off"
		autocapitalize="none"
		spellcheck="false"
		enterkeyhint="enter"
		@keydown.enter.prevent="emit('submit')"
	/>
</template>
