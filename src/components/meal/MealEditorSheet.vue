<script setup lang="ts">
/*
Create or edit a meal. Not in the design handoff — the prototype had no way to
add anything — so this is built around one rule: nothing is required except
being bothered to type at all.

Name, tags, ingredients and notes are each optional. A completely empty meal is
discarded on save; anything with content but no title is kept as "Untitled
idea", because losing what someone typed is worse than a placeholder name.
*/
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import BaseSheet from '@/components/ui/BaseSheet.vue'
import IngredientRow from '@/components/meal/IngredientRow.vue'
import { useDragSort } from '@/composables/useDragSort'
import { moveItem } from '@/lib/dragSort'
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

/** The pinned vocabulary first, then tags in use, then this meal's own. */
const tagOptions = computed(() => [
	...new Set([...settings.settings.tags, ...meals.usedTags, ...tags.value]),
])

function toggleTag(tag: string) {
	tags.value = tags.value.includes(tag) ? tags.value.filter((t) => t !== tag) : [...tags.value, tag]
}

function addTag() {
	const trimmed = newTag.value.trim()
	if (trimmed && !tags.value.includes(trimmed)) tags.value.push(trimmed)
	newTag.value = ''
}

/* ── Ingredient rows ──────────────────────────────────────────────────── */

/*
Rows are focused by key rather than by index, because a row can be removed
while the list is being typed into and an index would then point at a different
row than the one that was asked for.
*/
interface RowHandle {
	focus: () => void
	focusHandle: () => void
}

const rowRefs = new Map<number, RowHandle>()

function setRowRef(key: number, el: Element | ComponentPublicInstance | null) {
	if (el) rowRefs.set(key, el as unknown as RowHandle)
	else rowRefs.delete(key)
}

async function focusRow(key: number) {
	// A row added in this tick has no element yet.
	await nextTick()
	rowRefs.get(key)?.focus()
}

/** Adds a row and puts the cursor in it — the point of adding one is to type. */
function addRow() {
	const row = makeRow()
	rows.value.push(row)
	void focusRow(row.key)
}

function removeRow(key: number) {
	rows.value = rows.value.filter((row) => row.key !== key)
	// Deliberately not `addRow`: replacing the last row is not a request to type,
	// and stealing focus would pop the keyboard back up after a delete.
	if (!rows.value.length) rows.value.push(makeRow())
}

/**
 * Enter moves to the next row, adding one first if this was the last. Without
 * the focus call the new row appears and the cursor stays where it was, which
 * reads as the key having done nothing.
 */
function onRowEnter(key: number) {
	const index = rows.value.findIndex((row) => row.key === key)
	const next = index === -1 ? undefined : rows.value[index + 1]

	if (next) void focusRow(next.key)
	else addRow()
}

/* ── Ordering ─────────────────────────────────────────────────────────── */

/*
Ingredients are stored in the order they are typed and read back in that order
everywhere, so this is the order the meal is written down in — the shopping
list is alphabetical and unaffected by it.

The drag is a handle, not the whole row: the row is a text field, and a press
on a text field belongs to the caret. `useDragSort` measures the list and says
which slot the row has reached; moving it is this component's job, because the
rows are its state.
*/
const scroller = ref<HTMLElement | null>(null)

const {
	index: draggedIndex,
	offset: dragOffset,
	settling: dragSettling,
	start: grabRow,
} = useDragSort({
	move: (from, to) => {
		rows.value = moveItem(rows.value, from, to)
	},
	scroller: () => scroller.value,
})

/**
 * The keyboard's half of the same thing, from the handle: a control that can
 * only be operated by dragging cannot be operated without a pointer at all.
 *
 * Focus follows the row rather than the slot. Left where it was, a second press
 * would move whichever row had just slid into that position, so holding the key
 * down would shuffle the list instead of carrying one row through it.
 */
async function nudgeRow(index: number, delta: number) {
	const row = rows.value[index]
	const to = index + delta
	if (!row || to < 0 || to >= rows.value.length) return

	rows.value = moveItem(rows.value, index, to)

	await nextTick()
	rowRefs.get(row.key)?.focusHandle()
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

		<div ref="scroller" class="flex-1 overflow-y-auto px-4 py-4">
			<input
				v-model="name"
				class="input mb-1 text-card-title"
				placeholder="What's it called?"
				autocapitalize="sentences"
			/>
			<p class="mb-6 pl-1 text-meta text-subtle">Everything below is optional.</p>

			<section class="mb-6">
				<p class="label-micro mb-2">Tags</p>
				<div v-if="tagOptions.length" class="mb-2 flex flex-wrap gap-1.5">
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
					enterkeyhint="enter"
					@keydown.enter.prevent="addTag"
				/>
			</section>

			<section class="mb-6">
				<p class="label-micro mb-2">Ingredients</p>
				<!--
					A TransitionGroup so the rows a drag displaces slide out of its way
					rather than teleporting. `relative` is not decoration: the rows are
					measured with `offsetTop`, which needs this to be their offset parent.
				-->
				<TransitionGroup
					tag="div"
					name="ing"
					class="relative rounded-card bg-surface px-2"
					:class="{ 'select-none': draggedIndex !== -1 }"
				>
					<IngredientRow
						v-for="(row, index) in rows"
						:ref="(el) => setRowRef(row.key, el)"
						:key="row.key"
						v-model:text="row.text"
						v-model:store="row.store"
						data-sortable
						:lifted="draggedIndex === index && !dragSettling"
						:offset="draggedIndex === index ? dragOffset : 0"
						:settling="draggedIndex === index && dragSettling"
						@remove="removeRow(row.key)"
						@enter="onRowEnter(row.key)"
						@grab="grabRow"
						@nudge="nudgeRow(index, $event)"
					/>
				</TransitionGroup>
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

<style scoped>
/*
The FLIP transition TransitionGroup runs when a row changes slot. The row under
the finger is excluded: it is already positioned by the drag itself, and
letting the move animation have it too would make it trail the pointer by the
length of the animation every time it passed a neighbour.

`:has()` rather than a marker on the row itself, and that is not a style
preference. TransitionGroup asks whether a move can be animated at all by
cloning the FIRST row, adding this class to the clone and reading the clone's
transition back — so a rule that switched itself off from the row's own
attributes would switch the animation off for every row whenever the top one
was the row being dragged. The clone is shallow, so a marker one level inside
the row is invisible to it.
*/
.ing-move {
	transition: transform 180ms cubic-bezier(0.2, 0.7, 0.4, 1);
}

.ing-move:has([data-lifted]) {
	transition: none;
}

@media (prefers-reduced-motion: reduce) {
	.ing-move {
		transition: none;
	}
}
</style>
