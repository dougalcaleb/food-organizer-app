<script setup lang="ts">
/*
The four store chips, wherever an extra's store is chosen: the one-off input,
the staples shelf, and the inline editor on a shopping row. One component so
the set cannot drift between them, and so adding a fifth store is one edit.

The meal editor's ingredient row deliberately does not use this. Its store is
nullable — an ingredient with no usual place is the common case, and tapping
the active chip there clears it — which is a different control wearing the
same chips.

Callers own the spacing around it: the chips sit differently under an input
than they do inside a list row.
*/
import BaseChip from '@/components/ui/BaseChip.vue'
import { STORE_LABELS, STORES, type Store } from '@/types'

defineProps<{
	/** Micro-label before the chips, where the chips alone would be ambiguous. */
	label?: string
}>()

const store = defineModel<Store>({ required: true })

/*
Every chip tap, including one on the store already chosen. The model alone
cannot say this: `defineModel` suppresses an unchanged write, so a caller that
closes the picker on a pick would stay open on the one tap that means "leave
it as it is" — which is the only way out of a picker opened by accident.
*/
const emit = defineEmits<{ pick: [Store] }>()

function select(option: Store) {
	store.value = option
	emit('pick', option)
}
</script>

<template>
	<div class="flex flex-wrap items-center gap-1.5">
		<span v-if="label" class="label-micro mr-0.5">{{ label }}</span>

		<BaseChip
			v-for="option in STORES"
			:key="option"
			selectable
			:active="store === option"
			@click="select(option)"
		>
			{{ STORE_LABELS[option] }}
		</BaseChip>
	</div>
</template>
