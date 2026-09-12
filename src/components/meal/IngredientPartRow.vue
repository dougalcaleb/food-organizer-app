<script setup lang="ts">
/*
A part heading in the meal editor — "Sauce", "Marinade" — and everything typed
below it belongs to it.

It is a row in the same flat, sortable list as the ingredients, not a container
around them, which is the whole design: an ingredient's part is decided by which
heading it sits under, so dragging a row from one part to another is the same
gesture as dragging it up one slot, and no membership has to be edited anywhere.

Dragging the heading itself therefore moves the boundary rather than the part:
pulling it down past a row hands that row back to whatever came before. The
colour band redraws as it goes, so the effect is visible while it happens.
*/
import { computed, ref } from 'vue'
import { DROP_SETTLE_MS } from '@/composables/useDragSort'

const props = defineProps<{
	/** Colour class for the part, from `partClass()`. Absent while unnamed. */
	partClass?: string
	/** Under the finger: displaced by the drag and drawn as picked up. */
	lifted?: boolean
	/** Pixels below its own slot the row is currently being held. */
	offset?: number
	/** Set for the frames after release, while it travels into its slot. */
	settling?: boolean
}>()

const name = defineModel<string>('name', { required: true })

const emit = defineEmits<{
	remove: []
	enter: []
	grab: [event: PointerEvent]
	/** Keyboard reordering: -1 up a slot, +1 down. */
	nudge: [delta: number]
}>()

const input = ref<HTMLInputElement | null>(null)
const handle = ref<HTMLButtonElement | null>(null)

/* The editor drives focus between rows, and does not care which kind a row is. */
defineExpose({
	focus: () => input.value?.focus(),
	focusHandle: () => handle.value?.focus(),
})

/*
The root's border colour is one-sided on purpose — `border-b-border`, never
`border-border`. An all-sides colour utility outranks `.part-band`'s left stripe,
because Tailwind's utilities layer comes after its components layer, so the
stripe silently goes gray while the wash behind the row survives and the band
still reads as working.

And nothing may sit outside the root element, a comment included: that is what
this note is doing here rather than above it. A second root node makes the
component a fragment, which costs it the `data-sortable` and `class` the editor
passes in, and the drag then never starts.
*/

const settle = `${DROP_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.4, 1)`

const lift = computed(() => ({
	transform: props.offset ? `translateY(${props.offset}px)` : undefined,
	transition: props.settling
		? `transform ${settle}, box-shadow ${settle}, background-color ${settle}`
		: undefined,
}))
</script>

<template>
	<div :class="['border-b border-b-border last:border-b-0', partClass && `part-band ${partClass}`]">
		<!--
			`data-lifted` goes inside the row for the same reason it does on
			IngredientRow: TransitionGroup clones the FIRST row shallowly to decide
			whether a move can animate, so a marker on the root would switch the
			animation off for the whole list whenever the top row was the dragged one.
		-->
		<div
			class="relative rounded-control"
			:class="[lifted && 'bg-surface-raised shadow-raised', (lifted || settling) && 'z-10']"
			:data-lifted="lifted || settling || undefined"
			:style="lift"
		>
			<div class="flex items-center gap-2 py-1">
				<button
					ref="handle"
					type="button"
					class="btn btn-ghost btn-icon -mr-2 min-h-0 w-6 flex-none cursor-grab touch-none touch-callout-none text-subtle select-none"
					aria-label="Reorder part"
					@pointerdown="emit('grab', $event)"
					@keydown.up.prevent="emit('nudge', -1)"
					@keydown.down.prevent="emit('nudge', 1)"
				>
					<FaIcon icon="grip-vertical" />
				</button>

				<!--
					`enterkeyhint` for the reason every other field in the app has it:
					Chrome on Android otherwise labels the key "Next" and moves focus
					itself, dispatching no keydown at all.

					The heading reads as a heading — uppercase, in its own colour — so it
					cannot be mistaken for an ingredient in the list it sits in. Its
					colour comes from `.part-text` on the band, and a heading with no name
					yet has no band, so it falls back to the row's own text colour.
				-->
				<input
					ref="input"
					v-model="name"
					class="input flex-1 border-transparent bg-transparent pl-0.5 font-heading text-[13px] font-semibold tracking-[0.08em] uppercase"
					:class="partClass ? 'part-text' : 'text-muted'"
					placeholder="Part of the recipe"
					autocomplete="off"
					autocapitalize="sentences"
					enterkeyhint="enter"
					@keydown.enter.prevent="emit('enter')"
				/>

				<button
					type="button"
					class="btn btn-ghost btn-icon min-h-0 w-9 flex-none text-subtle"
					aria-label="Remove part"
					@click="emit('remove')"
				>
					<FaIcon icon="xmark" />
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
/* The lift is positioned with inline styles, so this has to outrank one. */
@media (prefers-reduced-motion: reduce) {
	[data-lifted] {
		transition: none !important;
	}
}
</style>
