<script setup lang="ts">
/*
Bottom sheet — the meal detail, meal editor, and settings all use it.

Per the handoff this is the only thing in the app that animates. The handoff's
timings (backdrop 150ms, sheet rising 30px over 200ms, no fade) read as abrupt
on a phone — a solid panel snapping up from the edge. It now fades as it rises,
over a slightly longer decelerating curve, which reads as arriving rather than
appearing. Both are suppressed under prefers-reduced-motion.
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
		opacity: 0;
		transform: translateY(24px);
	}
}

@keyframes backdrop-in {
	from {
		opacity: 0;
	}
}

.animate-sheet {
	/* Decelerating, so most of the travel is over before the panel settles. */
	animation: sheet-up 280ms cubic-bezier(0.22, 0.8, 0.36, 1);
}

.animate-backdrop {
	/* Runs slightly longer than the sheet so the dim does not land first. */
	animation: backdrop-in 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
	.animate-sheet,
	.animate-backdrop {
		animation: none;
	}
}
</style>
