<script setup lang="ts">
/*
Create or edit a meal. Not in the design handoff — the prototype had no way to
add anything — so this is built around one rule: nothing is required except
being bothered to type at all.

Name, tags, ingredients and notes are each optional. A completely empty meal is
discarded on save; anything with content but no title is kept as "Untitled
idea", because losing what someone typed is worse than a placeholder name.
*/
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import BaseSheet from '@/components/ui/BaseSheet.vue'
import IngredientRow from '@/components/meal/IngredientRow.vue'
import { formatIngredient } from '@/lib/parseIngredient'
import { draftHasContent, draftToPayload, type MealDraft } from '@/lib/mealDraft'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import { useSettingsStore } from '@/stores/settings'
import type { Store } from '@/types'

const props = defineProps<{ mealId?: string }>()
const open = defineModel<boolean>('open', { required: true })

const meals = useMealsStore()
const plan = usePlanStore()
const settings = useSettingsStore()

interface RowDraft {
	key: number
	text: string
	store: Store | undefined
}

let nextKey = 0
function makeRow(text = '', store?: Store): RowDraft {
	return { key: nextKey++, text, store }
}

const name = ref('')
const notes = ref('')
const tags = ref<string[]>([])
const rows = ref<RowDraft[]>([makeRow()])
const newTag = ref('')

const existing = computed(() => (props.mealId ? meals.get(props.mealId) : undefined))
const isEditing = computed(() => existing.value !== undefined)

/** Load the meal being edited, or reset to a blank draft for a new one. */
watch(
	() => props.mealId,
	() => {
		const meal = existing.value

		name.value = meal?.name ?? ''
		notes.value = meal?.notes ?? ''
		tags.value = [...(meal?.tags ?? [])]
		rows.value = meal?.ingredients.length
			? meal.ingredients.map((ing) => makeRow(formatIngredient(ing), ing.store))
			: [makeRow()]
	},
	{ immediate: true },
)

/* ── Tags ─────────────────────────────────────────────────────────────── */

/** The configured vocabulary plus anything already in use, minus duplicates. */
const tagOptions = computed(() => {
	const known = [...settings.settings.tags, ...meals.usedTags, ...tags.value]
	return [...new Set(known)]
})

function toggleTag(tag: string) {
	tags.value = tags.value.includes(tag) ? tags.value.filter((t) => t !== tag) : [...tags.value, tag]
}

function addTag() {
	const trimmed = newTag.value.trim()
	if (trimmed && !tags.value.includes(trimmed)) tags.value.push(trimmed)
	newTag.value = ''
}

/* ── Ingredient rows ──────────────────────────────────────────────────── */

function addRow() {
	rows.value.push(makeRow())
}

function removeRow(key: number) {
	rows.value = rows.value.filter((row) => row.key !== key)
	if (!rows.value.length) rows.value.push(makeRow())
}

/** Enter on the last row adds another; otherwise it just moves on. */
function onRowEnter(key: number) {
	if (rows.value[rows.value.length - 1]?.key === key) addRow()
}

/* ── Saving ───────────────────────────────────────────────────────────── */

const draft = computed<MealDraft>(() => ({
	name: name.value,
	notes: notes.value,
	tags: tags.value,
	rows: rows.value.map(({ text, store }) => ({ text, store })),
}))

const hasContent = computed(() => draftHasContent(draft.value))

async function save() {
	const payload = draftToPayload(draft.value)

	// Nothing typed anywhere — close without leaving a blank card behind.
	if (!payload) {
		open.value = false
		return
	}

	if (existing.value) {
		await meals.update(existing.value.id, payload)
	} else {
		await meals.create(payload)
	}

	open.value = false
}

async function remove() {
	if (!existing.value) return
	if (!window.confirm(`Delete “${existing.value.name}”? This also drops it from the plan.`)) return

	await meals.remove(existing.value.id)
	open.value = false
}

const isPlanned = computed(() => (props.mealId ? plan.isPlanned(props.mealId) : false))
</script>

<template>
	<BaseSheet v-model:open="open">
		<header class="flex flex-none items-center gap-3 border-b border-border px-4 pt-4 pb-3">
			<h2 class="flex-1 text-sheet-title">{{ isEditing ? 'Edit meal' : 'New meal' }}</h2>
			<BaseButton icon aria-label="Close" @click="open = false">
				<FaIcon icon="xmark" />
			</BaseButton>
		</header>

		<div class="flex-1 overflow-y-auto px-4 py-4">
			<input
				v-model="name"
				class="input mb-1 text-card-title"
				placeholder="What's it called?"
				autocapitalize="sentences"
			/>
			<p class="mb-6 pl-1 text-meta text-subtle">
				Everything here is optional — a name on its own is a perfectly good idea.
			</p>

			<section class="mb-6">
				<p class="label-micro mb-2">Tags</p>
				<div class="mb-2 flex flex-wrap gap-1.5">
					<BaseChip
						v-for="tag in tagOptions"
						:key="tag"
						selectable
						:active="tags.includes(tag)"
						@click="toggleTag(tag)"
					>
						{{ tag }}
					</BaseChip>
				</div>
				<input
					v-model="newTag"
					class="input"
					placeholder="Add a new tag"
					autocomplete="off"
					@keydown.enter.prevent="addTag"
				/>
			</section>

			<section class="mb-6">
				<p class="label-micro mb-2">Ingredients</p>
				<div class="rounded-card bg-surface px-2">
					<IngredientRow
						v-for="row in rows"
						:key="row.key"
						v-model:text="row.text"
						v-model:store="row.store"
						@remove="removeRow(row.key)"
						@enter="onRowEnter(row.key)"
					/>
				</div>
				<BaseButton variant="ghost" class="mt-2" @click="addRow">
					<FaIcon icon="plus" />
					Add ingredient
				</BaseButton>
			</section>

			<section class="mb-6">
				<p class="label-micro mb-2">Notes</p>
				<textarea
					v-model="notes"
					class="input min-h-24 resize-y"
					placeholder="However you'd explain it to yourself later."
				/>
			</section>

			<section v-if="isEditing">
				<BaseButton variant="danger" @click="remove">
					<FaIcon icon="trash" />
					Delete meal
				</BaseButton>
				<p v-if="isPlanned" class="mt-2 text-meta text-subtle">
					This meal is currently in the plan.
				</p>
			</section>
		</div>

		<footer class="safe-bottom flex flex-none gap-2 border-t border-border px-4 pt-3">
			<BaseButton class="flex-1" @click="open = false">Cancel</BaseButton>
			<BaseButton variant="primary" class="flex-1" @click="save">
				{{ hasContent ? 'Save' : 'Done' }}
			</BaseButton>
		</footer>
	</BaseSheet>
</template>
