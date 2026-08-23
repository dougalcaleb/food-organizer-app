<script setup lang="ts">
/*
One line on the shopping list.

Only the checkbox checks the item off. The whole row used to be the tap target,
on the reasoning that a small checkbox is not something to aim at one-handed in
a shop — but the failure it produced is worse than a missed tap. An accidental
check moves the line into the cart, out of the section being read, and the
thing gets left on the shelf. A missed tap is noticed immediately; a stray one
is noticed at home.

So the target stays large, it just stops covering the words: the checkbox is
its own 44px column running the full height of the row, negative margins and
all, and the text beside it is inert. It is the same tap area the checkbox
always had, minus the part that was over something else's label.

An extra's store is editable here by holding the row, which opens a picker on a
second line. That is a gesture rather than a control for the same reason the
words are inert: there is no room on this row for a target that is not the
checkbox, and a hold is the one input that cannot be made by accident.
*/
import { ref } from 'vue'
import StorePicker from '@/components/ui/StorePicker.vue'
import { useLongPress } from '@/composables/useLongPress'
import type { Store } from '@/types'

/**
 * Loose on purpose: open rows come from `groupItems` and carry a meta line,
 * while cart rows are the raw merged items and deliberately show none.
 */
interface RowItem {
	key: string
	name: string
	qty: string
	meta?: string
}

const props = defineProps<{
	item: RowItem
	checked?: boolean
	/** Shown only for extras. `true` when the item is already a staple. */
	staple?: boolean
	canPin?: boolean
	/**
	 * The stored store of the extra behind this row. Present only when there is
	 * a record to edit — a meal ingredient's store belongs to the meal, and a
	 * row already in the cart has been bought — and its presence is what makes
	 * the row hold-to-edit.
	 */
	store?: Store
}>()

const emit = defineEmits<{ toggle: []; pin: []; 'update:store': [Store] }>()

const editing = ref(false)

const press = useLongPress(() => {
	if (props.store) editing.value = !editing.value
})

/*
The hold's own release still arrives as a click. Without this, holding over the
checkbox would open the picker and check the item off in one gesture.
*/
function onToggle() {
	if (press.consumeClick()) return
	emit('toggle')
}

function onPin() {
	if (press.consumeClick()) return
	emit('pin')
}

// Closing on any pick is also the way out: tapping the store the row already
// has dismisses the picker without changing anything.
function closePicker() {
	editing.value = false
}
</script>

<template>
	<div
		class="list-row flex-wrap items-stretch gap-0"
		:class="store ? 'touch-callout-none select-none' : ''"
		v-on="store ? press.handlers : {}"
	>
		<!--
			The negative margins cancel `.list-row`'s own padding so the target
			reaches the row's edges; `pt-3` then puts the box back on the first
			line of text, where `mt-0.5` used to hold it.
		-->
		<button
			type="button"
			class="-my-2.5 -ml-3 flex w-11 flex-none items-start justify-center self-stretch pt-3"
			:aria-pressed="checked"
			:aria-label="checked ? `Put ${item.name} back on the list` : `Check off ${item.name}`"
			@click="onToggle"
		>
			<span
				class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border"
				:class="checked ? 'border-accent bg-accent text-on-accent' : 'border-subtle'"
			>
				<FaIcon v-if="checked" icon="check" class="text-[9px]" />
			</span>
		</button>

		<div class="min-w-0 flex-1">
			<span class="flex items-baseline gap-2">
				<span
					class="flex-1 text-[15px] leading-snug"
					:class="checked ? 'text-subtle line-through' : ''"
				>
					{{ item.name }}
				</span>
				<span
					v-if="item.qty"
					class="flex-none font-heading text-sm font-semibold whitespace-nowrap"
					:class="checked ? 'text-subtle' : 'text-accent'"
				>
					{{ item.qty }}
				</span>
			</span>

			<span v-if="item.meta && !checked" class="mt-0.5 block text-meta text-muted text-pretty">
				{{ item.meta }}
			</span>
		</div>

		<button
			v-if="canPin"
			type="button"
			class="-my-2.5 -mr-1 flex w-11 flex-none items-center justify-center self-stretch"
			:class="staple ? 'text-accent' : 'text-faint'"
			:aria-label="staple ? 'Stop buying this regularly' : 'Buy this regularly'"
			:aria-pressed="staple"
			@click="onPin"
		>
			<FaIcon icon="repeat" class="text-xs" />
		</button>

		<!--
			Wraps onto its own flex line rather than nesting, so the row stays a
			single `.list-row` and the dividers between rows keep working.
		-->
		<div v-if="editing && store" class="w-full pt-3 pl-8">
			<StorePicker
				:model-value="store"
				label="Buy at"
				@update:model-value="emit('update:store', $event)"
				@pick="closePicker"
			/>
		</div>
	</div>
</template>
