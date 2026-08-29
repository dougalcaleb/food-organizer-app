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
import { fmtQty } from '@/lib/quantities'
import type { Meal } from '@/types'

const props = defineProps<{
	meal: Meal
	/** Normalized names of this meal's ingredients currently on the list. */
	pulled: readonly string[]
	meta: string
	expanded: boolean
}>()

const emit = defineEmits<{ tap: []; hold: []; pick: [name: string] }>()

// A meal with no ingredients has nothing to open, so it takes neither gesture:
// its tap button is disabled, and a hold that revealed an empty panel would
// read as the app hanging on the vibration.
const press = useLongPress(() => {
	if (props.meal.ingredients.length) emit('hold')
})

/** All of them on the list — the state where a tap takes them back off again. */
const all = computed(
	() => props.meal.ingredients.length > 0 && props.pulled.length >= props.meal.ingredients.length,
)

function isPulled(name: string): boolean {
	return props.pulled.includes(name.trim().toLowerCase())
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
			:disabled="!meal.ingredients.length"
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
		<div v-if="expanded && meal.ingredients.length" class="w-full pr-3 pb-2.5 pl-10.5">
			<button
				v-for="(ing, i) in meal.ingredients"
				:key="i"
				type="button"
				class="flex w-full items-baseline gap-2.5 py-1.5 text-left"
				:aria-pressed="isPulled(ing.name)"
				@click="onPick(ing.name)"
			>
				<span
					class="flex h-[15px] w-[15px] flex-none translate-y-0.5 items-center justify-center rounded-[5px] border"
					:class="isPulled(ing.name) ? 'border-accent bg-accent text-on-accent' : 'border-subtle'"
				>
					<FaIcon v-if="isPulled(ing.name)" icon="check" class="text-[8px]" />
				</span>

				<span
					class="min-w-0 flex-1 text-sm leading-snug"
					:class="isPulled(ing.name) ? '' : 'text-muted'"
				>
					{{ ing.name }}
				</span>

				<span
					v-if="fmtQty(ing.amount, ing.unit)"
					class="flex-none font-heading text-meta font-semibold whitespace-nowrap"
					:class="isPulled(ing.name) ? 'text-accent' : 'text-subtle'"
				>
					{{ fmtQty(ing.amount, ing.unit) }}
				</span>
			</button>
		</div>
	</div>
</template>
