<script setup lang="ts">
/*
One planned meal, on the shopping list's "From the plan" section.

Tap adds everything the meal needs; hold opens its ingredients so a subset can
be picked. That is the same division of labour as the shopping row — the cheap,
frequent action on the tap, the occasional one behind a gesture that cannot
happen by accident — and it is why a meal here is a row rather than a chip.

Unlike a shopping row, the whole row IS the tap target. The reason a shopping
row's words are inert does not apply here: a stray tap adds a meal's
ingredients, which is visible immediately in the sections above and undone by
tapping the same row again, where a stray check-off hides a line until you are
already home.

Nothing may sit outside the root <div>, comments included: a second root node
costs the component its attribute fallthrough and leaves Test Utils dispatching
at a fragment anchor rather than at the element holding the press handlers, so
the hold simply stops arriving.
*/
import { computed } from 'vue'
import { useLongPress } from '@/composables/useLongPress'
import { mergeIngredients } from '@/lib/mealIngredients'
import type { Meal } from '@/types'

const props = defineProps<{
	meal: Meal
	/** Normalized names of this meal's ingredients currently on the list. */
	pulled: readonly string[]
	meta: string
	expanded: boolean
}>()

const emit = defineEmits<{ tap: []; hold: []; pick: [name: string] }>()

/*
Things to buy, not rows of the recipe. An ingredient that two parts of the meal
both want is written into both of them, and a pull records one normalized name
per thing — so merging here is what keeps the picker's ticks, the row's
completeness and the line that ends up on the list all talking about the same
set. Unmerged, a shared ingredient would show twice, tick twice at once, and
leave the meal one short of "all on the list" forever.
*/
const items = computed(() => mergeIngredients(props.meal.ingredients))

// A meal with no ingredients has nothing to open, so it takes neither gesture:
// its tap button is disabled, and a hold that revealed an empty panel would
// read as the app hanging on the vibration.
const press = useLongPress(() => {
	if (items.value.length) emit('hold')
})

/** All of them on the list — the state where a tap takes them back off again. */
const all = computed(() => items.value.length > 0 && props.pulled.length >= items.value.length)

function isPulled(key: string): boolean {
	return props.pulled.includes(key)
}

// The hold's own release still arrives as a click. Without this, holding a row
// would open the ingredients and add the whole meal in one gesture.
function onTap() {
	if (press.consumeClick()) return
	emit('tap')
}

function onPick(name: string) {
	if (press.consumeClick()) return
	emit('pick', name)
}
</script>

<template>
	<div
		class="list-row touch-callout-none flex-wrap items-stretch gap-0 p-0 select-none"
		v-on="press.handlers"
	>
		<!--
			Two things here are load-bearing, and both look like arbitrary styling.

			`w-full`, not `flex-1`: a flex container breaks lines on each child's
			HYPOTHETICAL main size, and `flex-1` sets `flex-basis: 0`, so a
			zero-width button and a 100%-width panel "fit" on one line together —
			the name collapses to a column a few characters wide and the ingredients
			are painted over it. ShoppingRow escapes that only because its fixed
			`w-11` checkbox and pin columns push the same line past 100%.

			And the padding is here rather than on the row (`p-0` above), because
			the usual way to make a tap target reach a row's edges — row padding,
			negative margins on the child — makes this button's margin box smaller
			than its border box. It then overflows its own flex line, and the
			ingredients below are drawn over its second line of text.
		-->
		<button
			type="button"
			class="flex w-full items-start gap-3 px-3 py-2.75 text-left"
			:aria-pressed="all"
			:disabled="!items.length"
			@click="onTap"
		>
			<span
				class="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border"
				:class="all ? 'border-accent bg-accent text-on-accent' : 'border-subtle text-accent'"
			>
				<FaIcon :icon="all ? 'check' : 'plus'" class="text-[9px]" />
			</span>

			<span class="min-w-0 flex-1">
				<span class="block text-[15px] leading-snug text-pretty">{{ meal.name }}</span>
				<span class="mt-0.5 block text-meta text-muted">{{ meta }}</span>
			</span>
		</button>

		<!--
			Wraps onto its own flex line rather than nesting, so the row stays a
			single `.list-row` and the dividers between rows keep working. The
			indent lines the ingredient checkboxes up past the meal's own, which is
			what says they belong to it: the row's padding, plus the checkbox, plus
			the gap after it.
		-->
		<div v-if="expanded && items.length" class="w-full pr-3 pb-2.5 pl-10.5">
			<button
				v-for="item in items"
				:key="item.key"
				type="button"
				class="flex w-full items-baseline gap-2.5 py-1.5 text-left"
				:aria-pressed="isPulled(item.key)"
				@click="onPick(item.name)"
			>
				<!--
					Two rules, and this box needs both. Checking it must not change its
					geometry: the tick is always rendered and only its opacity changes,
					because a `v-if` makes the box empty in one state and gives it an
					<svg> child in the other, and a flex item's baseline is computed
					from its own content. And it must not sit on the row's baseline at
					all — `self-start` with a static `mt-0.5` centres it on the first
					line of text, the way the meal row above does it. The name and the
					amount still share a baseline with each other, which is what
					`items-baseline` on the row is for.
				-->
				<span
					class="mt-0.5 flex h-[15px] w-[15px] flex-none items-center justify-center self-start rounded-[5px] border"
					:class="isPulled(item.key) ? 'border-accent bg-accent text-on-accent' : 'border-subtle'"
				>
					<FaIcon icon="check" class="text-[8px]" :class="isPulled(item.key) ? '' : 'opacity-0'" />
				</span>

				<span
					class="min-w-0 flex-1 text-sm leading-snug"
					:class="isPulled(item.key) ? '' : 'text-muted'"
				>
					{{ item.name }}
				</span>

				<span
					v-if="item.qty"
					class="flex-none font-heading text-meta font-semibold whitespace-nowrap"
					:class="isPulled(item.key) ? 'text-accent' : 'text-subtle'"
				>
					{{ item.qty }}
				</span>
			</button>
		</div>
	</div>
</template>
