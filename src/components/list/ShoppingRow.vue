<script setup lang="ts">
/*
One line on the shopping list. The whole row is the tap target — at the store,
one-handed, a small checkbox is not something worth aiming at.

Extras carry a second control for switching between a one-off and a staple,
which is why the row is a wrapper with a button inside rather than being a
button itself: a button cannot legally contain another button.
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
		<button
			type="button"
			class="flex min-w-0 flex-1 items-start gap-2.5 text-left"
			:aria-pressed="checked"
			@click="$emit('toggle')"
		>
			<span
				class="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border"
				:class="checked ? 'border-accent bg-accent text-on-accent' : 'border-subtle'"
			>
				<FaIcon v-if="checked" icon="check" class="text-[9px]" />
			</span>

			<span class="min-w-0 flex-1">
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
			</span>
		</button>

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
