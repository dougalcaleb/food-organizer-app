<script setup lang="ts">
/*
Bottom sheet — the meal detail, meal editor, settings and the trip confirmation
all use it.

Per the handoff this was the only thing in the app that animates, and it is
still the only screen-sized one — the other is an ingredient row sliding out of
the way of one being dragged past it. The handoff's timings (backdrop 150ms,
sheet rising 30px over 200ms, no fade) read as abrupt on a phone — a solid panel snapping up from the edge. It now fades as it rises,
over a slightly longer decelerating curve, which reads as arriving rather than
appearing.

Leaving is its own pair of keyframes, running forwards, roughly twice as fast:
a sheet that fades in and then blinks out feels broken, but a dismissal should
not make you wait. What matters more than the number is that it starts moving
on the first frame — see the note by the leave rules. The transition is
explicitly timed rather than sniffed from the CSS, because the animations live
on the children and Vue only measures the transitioned element itself.

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

/*
The exits are written out rather than played as `reverse`, even though the
travel is identical. `reverse` reverses the TIMING FUNCTION along with the
keyframes — the spec's own example is that an ease-in plays back as an ease-out
— so the curve on a reversed rule is the mirror of what it says, and both ways
of getting that wrong ship a sheet that lingers. Written forwards, the curve
means what it reads as.
*/
@keyframes sheet-down {
	to {
		opacity: 0;
		transform: translateY(24px);
	}
}

@keyframes backdrop-out {
	to {
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

/*
An exit is judged almost entirely on its first frame, and a curve is lazy at
whichever end its nearer control point flattens. Both ways of being lazy were
tried here and both were called slow, at durations that were not:

  decelerating  fast off the mark, then creeping between barely-there and gone
  accelerating  a beat of nothing before the panel admits it is leaving

So the curve below is neither. It breaks away immediately — the first control
point is well above the diagonal — and still has real speed at the end, which
is what `0.95` rather than `1` buys. The duration is then free to be short
without anything looking clipped.

`forwards` is separate, and stops the panel snapping back to fully open for the
frames between the animation ending and the sheet being unmounted.
*/
.sheet-leave-active .sheet-panel {
	animation: sheet-down 140ms cubic-bezier(0.25, 0.6, 0.65, 0.95);
	animation-fill-mode: forwards;
}

.sheet-leave-active .sheet-backdrop {
	/* Lifts a touch faster than the panel, so the room is bright again first. */
	animation: backdrop-out 120ms cubic-bezier(0.25, 0.6, 0.65, 0.95);
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
