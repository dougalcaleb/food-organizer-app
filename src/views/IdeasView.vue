<script setup lang="ts">
/*
The permanent library — every meal ever liked, so nothing gets forgotten.

Search matches name, any ingredient, or any tag. Tag filters are AND-ed: a meal
must carry every selected tag.
*/
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import MealCard from '@/components/meal/MealCard.vue'
import { useSheet } from '@/composables/useSheet'
import { recentFirst, staleFirst } from '@/lib/dates'
import { useMealsStore } from '@/stores/meals'
import { useSettingsStore } from '@/stores/settings'
import type { IdeaSort } from '@/types'

const meals = useMealsStore()
const settings = useSettingsStore()
const { open } = useSheet()

const query = ref('')
const activeTags = ref<string[]>([])
const sort = ref<IdeaSort>('stale')

const sorts: { id: IdeaSort; label: string }[] = [
	{ id: 'stale', label: 'Been longest' },
	{ id: 'recent', label: 'Most recent' },
	{ id: 'az', label: 'A–Z' },
]

/** Vocabulary plus anything actually in use, so a one-off tag is filterable. */
const tagOptions = computed(() => [...new Set([...settings.settings.tags, ...meals.usedTags])])

function toggleTag(tag: string) {
	activeTags.value = activeTags.value.includes(tag)
		? activeTags.value.filter((t) => t !== tag)
		: [...activeTags.value, tag]
}

const filtered = computed(() => {
	const q = query.value.trim().toLowerCase()

	const matches = meals.meals.filter((meal) => {
		if (activeTags.value.length && !activeTags.value.every((t) => meal.tags.includes(t))) {
			return false
		}

		if (!q) return true

		return (
			meal.name.toLowerCase().includes(q) ||
			meal.tags.some((t) => t.toLowerCase().includes(q)) ||
			meal.ingredients.some((i) => i.name.toLowerCase().includes(q))
		)
	})

	const sorted = [...matches]

	if (sort.value === 'stale') {
		// Never-made meals lead — which is the entire point of jotting an idea down.
		sorted.sort(staleFirst)
	} else if (sort.value === 'recent') {
		sorted.sort(recentFirst)
	} else {
		sorted.sort((a, b) => a.name.localeCompare(b.name))
	}

	return sorted
})

/** Pick at random from what is on screen, falling back to everything. */
function shuffle() {
	const pool = filtered.value.length ? filtered.value : meals.meals
	if (!pool.length) return

	open('meal', pool[Math.floor(Math.random() * pool.length)].id)
}

const meta = computed(() => `${filtered.value.length} of ${meals.meals.length}`)
</script>

<template>
	<PageHeader kicker="Everything I have ever liked" title="Meal ideas" :meta="meta" />

	<div class="flex flex-col gap-2.5 px-4 pt-2 pb-3">
		<div class="flex gap-2">
			<input
				v-model="query"
				class="input"
				type="search"
				placeholder="Search ideas or ingredients"
				autocomplete="off"
			/>
			<BaseButton class="flex-none" :disabled="!meals.meals.length" @click="shuffle">
				<FaIcon icon="shuffle" />
				Shuffle
			</BaseButton>
		</div>

		<div v-if="tagOptions.length" class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
			<BaseChip
				v-for="tag in tagOptions"
				:key="tag"
				selectable
				:active="activeTags.includes(tag)"
				@click="toggleTag(tag)"
			>
				{{ tag }}
			</BaseChip>
		</div>

		<div class="flex items-center gap-4">
			<span class="label-micro">Sort</span>
			<button
				v-for="option in sorts"
				:key="option.id"
				type="button"
				class="font-heading text-[13px] font-semibold transition-colors"
				:class="
					sort === option.id
						? 'border-b border-accent text-accent'
						: 'border-b border-transparent text-subtle'
				"
				@click="sort = option.id"
			>
				{{ option.label }}
			</button>
		</div>
	</div>

	<div class="flex flex-col gap-2.5 px-4 pb-6">
		<MealCard v-for="meal in filtered" :key="meal.id" :meal="meal" @click="open('meal', meal.id)" />

		<p v-if="!meals.meals.length" class="px-1 py-8 text-sm text-muted">
			Nothing saved yet. Jot down anything you like the sound of — a name on its own is enough.
		</p>
		<p v-else-if="!filtered.length" class="px-1 py-8 text-sm text-muted">
			Nothing matches that filter.
		</p>
	</div>

	<!-- Sits above the tab bar, out of the way of the list. -->
	<BaseButton
		variant="primary"
		icon
		class="fixed right-4 bottom-24 z-float shadow-raised"
		aria-label="New meal"
		@click="open('editor')"
	>
		<FaIcon icon="plus" />
	</BaseButton>
</template>
