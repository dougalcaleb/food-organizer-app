<script setup lang="ts">
/*
One ingredient row in the meal editor: a single free-text field that gets
parsed into amount / unit / name, plus a store chip.

The parse result is shown under the field only when something was actually
split out, so the common case ("olive oil") stays visually quiet and a
misparse is immediately visible rather than silently wrong.

The row can also be dragged into a new position by its handle. The editor owns
the reordering — this component only reports the grab and paints the lift.
*/
import { computed, ref } from 'vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import { DROP_SETTLE_MS } from '@/composables/useDragSort'
import { parseIngredient } from '@/lib/parseIngredient'
import { STORE_LABELS, STORES, type Store } from '@/types'

const props = defineProps<{
	/** Under the finger: displaced by the drag and drawn as picked up. */
	lifted?: boolean
	/** Pixels below its own slot the row is currently being held. */
	offset?: number
	/** Set for the frames after release, while it travels into its slot. */
	settling?: boolean
}>()

const text = defineModel<string>('text', { required: true })
const store = defineModel<Store | undefined>('store', { required: true })

const emit = defineEmits<{
	remove: []
	enter: []
	grab: [event: PointerEvent]
	/** Keyboard reordering: -1 up a slot, +1 down. */
	nudge: [delta: number]
}>()

const storeOpen = ref(false)
const input = ref<HTMLInputElement | null>(null)
const handle = ref<HTMLButtonElement | null>(null)

/*
The editor drives focus between rows — Enter on one row lands on the next, and
a row moved with the keyboard keeps the handle it was moved by.
*/
defineExpose({
	focus: () => input.value?.focus(),
	focusHandle: () => handle.value?.focus(),
})

const parsed = computed(() => parseIngredient(text.value))

/** "2 cans · coconut milk" — only shown when the parse actually did something. */
const preview = computed(() => {
	if (!parsed.value.parsed) return null

	const quantity = [parsed.value.amount, parsed.value.unit].filter(Boolean).join(' ')
	return `${quantity} · ${parsed.value.name}`
})

/*
Nothing is transitioned while the finger is down: the row is following a hand
that is already where it is being eased towards, and easing reads as lag. On
release it becomes a transition and the whole lift lands together — the travel,
the shadow and the raised fill, so the row settles rather than arriving and then
flattening a beat later.
*/
const settle = `${DROP_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.4, 1)`

const lift = computed(() => ({
	transform: props.offset ? `translateY(${props.offset}px)` : undefined,
	transition: props.settling
		? `transform ${settle}, box-shadow ${settle}, background-color ${settle}`
		: undefined,
}))

function pickStore(value: Store) {
	store.value = store.value === value ? undefined : value
	storeOpen.value = false
}
</script>

<template>
	<div class="border-b border-border last:border-b-0">
		<!--
			`data-lifted` marks a row the drag is positioning — under the finger or
			settling out of it — for the editor's move animation, and it is
			deliberately here rather than on the row's root element. TransitionGroup
			decides whether a move is animatable at all by cloning the FIRST row —
			shallowly, so this element is not in the clone — and reading the clone's
			transition. A marker on the root would therefore turn the animation off
			for the whole list every time the top row was the one being dragged.
		-->
		<div
			class="relative rounded-control"
			:class="[lifted && 'bg-surface-raised shadow-raised', (lifted || settling) && 'z-10']"
			:data-lifted="lifted || settling || undefined"
			:style="lift"
		>
			<div class="flex items-center gap-2 py-1">
				<!--
					`touch-none` is what makes this draggable on a phone at all: left to
					itself the browser takes the same downward drag as a scroll of the
					sheet and stops sending move events. `select-none` and
					`touch-callout-none` are the other two offers the browser makes for a
					press and hold, and both have to be declined separately.
				-->
				<button
					ref="handle"
					type="button"
					class="btn btn-ghost btn-icon -mr-2 min-h-0 w-6 flex-none cursor-grab touch-none touch-callout-none text-subtle select-none"
					aria-label="Reorder ingredient"
					@pointerdown="emit('grab', $event)"
					@keydown.up.prevent="emit('nudge', -1)"
					@keydown.down.prevent="emit('nudge', 1)"
				>
					<FaIcon icon="grip-vertical" />
				</button>

				<!--
					`enterkeyhint` is load-bearing, not cosmetic. Left to itself Chrome on
					Android labels this key "Next" and handles it natively, moving focus to
					the next field in the document — the Notes box — without ever
					dispatching a keydown. Asking for a plain return means the handler below
					runs and the editor decides where focus goes.

					The gap to the grip was made of three things: the dead space either
					side of it inside its own button, the row's gap, and this padding. The
					button keeps its width, because that is what there is to aim at, but
					the other two are gone — `-mr-2` on the handle cancels the row gap for
					that pair alone. The grip and the words are one row's worth of one
					thing; the chip and the delete button after them are separate
					controls, and keep the full gap that says so.
				-->
				<input
					ref="input"
					v-model="text"
					class="input flex-1 border-transparent bg-transparent pl-0.5"
					placeholder="e.g. 2 cans coconut milk"
					autocomplete="off"
					autocapitalize="none"
					enterkeyhint="enter"
					@keydown.enter.prevent="emit('enter')"
				/>

				<button
					type="button"
					class="chip flex-none"
					:class="{ 'chip-active': store !== undefined }"
					@click="storeOpen = !storeOpen"
				>
					{{ store ? STORE_LABELS[store] : 'Store' }}
				</button>

				<button
					type="button"
					class="btn btn-ghost btn-icon min-h-0 w-9 flex-none text-subtle"
					aria-label="Remove ingredient"
					@click="emit('remove')"
				>
					<FaIcon icon="xmark" />
				</button>
			</div>

			<div v-if="storeOpen" class="flex flex-wrap gap-1.5 pt-1 pb-2">
				<BaseChip
					v-for="option in STORES"
					:key="option"
					selectable
					:active="store === option"
					@click="pickStore(option)"
				>
					{{ STORE_LABELS[option] }}
				</BaseChip>
			</div>

			<p v-else-if="preview" class="pb-2 pl-3 text-meta text-subtle">
				{{ preview }}
			</p>
		</div>
	</div>
</template>

<style scoped>
/*
The settle is a short travel, but every other animation in the app is dropped
under reduced motion and an exception is dearer to explain than to keep. Inline
styles are what the drag positions the row with, so this has to outrank one.
*/
@media (prefers-reduced-motion: reduce) {
	[data-lifted] {
		transition: none !important;
	}
}
</style>
