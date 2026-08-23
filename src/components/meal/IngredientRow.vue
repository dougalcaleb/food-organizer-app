<script setup lang="ts">
/*
One ingredient row in the meal editor: a single free-text field that gets
parsed into amount / unit / name, plus a store chip.

The parse result is shown under the field only when something was actually
split out, so the common case ("olive oil") stays visually quiet and a
misparse is immediately visible rather than silently wrong.
*/
import { computed, ref } from 'vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import { parseIngredient } from '@/lib/parseIngredient'
import { STORE_LABELS, STORES, type Store } from '@/types'

const text = defineModel<string>('text', { required: true })
const store = defineModel<Store | undefined>('store', { required: true })

const emit = defineEmits<{ remove: []; enter: [] }>()

const storeOpen = ref(false)
const input = ref<HTMLInputElement | null>(null)

/* The editor drives focus between rows — Enter on one row lands on the next. */
defineExpose({ focus: () => input.value?.focus() })

const parsed = computed(() => parseIngredient(text.value))

/** "2 cans · coconut milk" — only shown when the parse actually did something. */
const preview = computed(() => {
	if (!parsed.value.parsed) return null

	const quantity = [parsed.value.amount, parsed.value.unit].filter(Boolean).join(' ')
	return `${quantity} · ${parsed.value.name}`
})

function pickStore(value: Store) {
	store.value = store.value === value ? undefined : value
	storeOpen.value = false
}
</script>

<template>
	<div class="border-b border-border last:border-b-0">
		<div class="flex items-center gap-2 py-1">
			<!--
				`enterkeyhint` is load-bearing, not cosmetic. Left to itself Chrome on
				Android labels this key "Next" and handles it natively, moving focus to
				the next field in the document — the Notes box — without ever
				dispatching a keydown. Asking for a plain return means the handler below
				runs and the editor decides where focus goes.
			-->
			<input
				ref="input"
				v-model="text"
				class="input flex-1 border-transparent bg-transparent"
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
</template>
