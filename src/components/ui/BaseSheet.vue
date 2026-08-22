<script setup lang="ts">
/*
Bottom sheet — the meal detail, meal editor, and settings all use it.

Per the handoff this is the only thing in the app that animates: the backdrop
fades in over 150ms, the sheet rises 30px over 200ms. Both are suppressed under
prefers-reduced-motion.
*/
import { onBeforeUnmount, onMounted } from 'vue'

const open = defineModel<boolean>('open', { required: true })

function close() {
	open.value = false
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
	<Teleport to="body">
		<div v-if="open" class="fixed inset-0 z-sheet flex items-end">
			<!-- Backdrop. Tapping it closes, per the handoff. -->
			<button
				type="button"
				class="animate-backdrop absolute inset-0 bg-black/55"
				aria-label="Close"
				@click="close"
			/>

			<div
				class="animate-sheet relative flex max-h-[88%] w-full flex-col rounded-t-sheet border-t border-accent bg-bg shadow-sheet"
				role="dialog"
				aria-modal="true"
			>
				<slot />
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
@keyframes sheet-up {
	from {
		transform: translateY(30px);
	}
}

@keyframes backdrop-in {
	from {
		opacity: 0;
	}
}

.animate-sheet {
	animation: sheet-up 200ms ease-out;
}

.animate-backdrop {
	animation: backdrop-in 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
	.animate-sheet,
	.animate-backdrop {
		animation: none;
	}
}
</style>
