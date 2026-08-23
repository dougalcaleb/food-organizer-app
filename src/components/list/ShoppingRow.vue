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
*/
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

defineProps<{
	item: RowItem
	checked?: boolean
	/** Shown only for extras. `true` when the item is already a staple. */
	staple?: boolean
	canPin?: boolean
}>()

defineEmits<{ toggle: []; pin: [] }>()
</script>

<template>
	<div class="list-row items-stretch gap-0">
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
			@click="$emit('toggle')"
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
			@click="$emit('pin')"
		>
			<FaIcon icon="repeat" class="text-xs" />
		</button>
	</div>
</template>
