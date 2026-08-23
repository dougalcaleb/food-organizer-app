<script setup lang="ts">
/*
Bottom sheet — the meal detail, meal editor, settings and the trip confirmation
all use it.

Per the handoff this is the only thing in the app that animates. The handoff's
timings (backdrop 150ms, sheet rising 30px over 200ms, no fade) read as abrupt
on a phone — a solid panel snapping up from the edge. It now fades as it rises,
over a slightly longer decelerating curve, which reads as arriving rather than
appearing.

Leaving runs the same two keyframes in reverse, slightly quicker and on an
accelerating curve: a sheet that fades in and then blinks out feels broken, but
a dismissal should not make you wait. The transition is explicitly timed rather
than sniffed from the CSS, because the animations live on the children and Vue
only measures the transitioned element itself.

Both directions are suppressed under prefers-reduced-motion. Whoever mounts a
sheet has to keep it mounted for `SHEET_EXIT_MS` after closing it — unmounting
on close skips the leave entirely.
*/
import { onBeforeUnmount, onMounted } from 'vue'
import { SHEET_EXIT_MS } from '@/composables/useSheet'

const open = defineModel<boolean>('open', { required: true })

const ENTER_MS = 300

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
		<!-- `appear` is not optional here: a sheet is mounted already open, and a
		     Transition skips the enter on its first render without it. -->
		<Transition appear name="sheet" :duration="{ enter: ENTER_MS, leave: SHEET_EXIT_MS }">
			<div v-if="open" class="fixed inset-0 z-sheet flex items-end">
				<!-- Backdrop. Tapping it closes, per the handoff. -->
				<button
					type="button"
					class="sheet-backdrop absolute inset-0 bg-black/55"
					aria-label="Close"
					@click="close"
				/>

				<div
					class="sheet-panel relative flex max-h-[88%] w-full flex-col rounded-t-sheet border-t border-accent bg-bg shadow-sheet"
					role="dialog"
					aria-modal="true"
				>
					<slot />
				</div>
			</div>
		</Transition>
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

.sheet-enter-active .sheet-panel {
	/* Decelerating, so most of the travel is over before the panel settles. */
	animation: sheet-up 280ms cubic-bezier(0.22, 0.8, 0.36, 1);
}

.sheet-enter-active .sheet-backdrop {
	/* Runs slightly longer than the sheet so the dim does not land first. */
	animation: backdrop-in 300ms ease-out;
}

.sheet-leave-active .sheet-panel {
	/* The same travel, reversed and accelerating away. `forwards` is what stops
	   the panel snapping back to fully open for the frames between the
	   animation ending and the sheet being unmounted. */
	animation: sheet-up 220ms cubic-bezier(0.4, 0, 1, 1) reverse;
	animation-fill-mode: forwards;
}

.sheet-leave-active .sheet-backdrop {
	/* Lifts a touch faster than the panel, so the room is bright again first. */
	animation: backdrop-in 180ms ease-in reverse;
	animation-fill-mode: forwards;
}

@media (prefers-reduced-motion: reduce) {
	.sheet-enter-active .sheet-panel,
	.sheet-enter-active .sheet-backdrop,
	.sheet-leave-active .sheet-panel,
	.sheet-leave-active .sheet-backdrop {
		animation: none;
	}
}
</style>
