<script setup lang="ts">
/*
The rolling set of meals intended soon. No dates and no week boundary — meals
leave only when you act, either by removing them or by cooking them.

"Been a while" is the counterweight to that: it resurfaces ideas that have gone
stale, which is the whole reason the Ideas library is worth keeping.
*/
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlannedMealCard from '@/components/meal/PlannedMealCard.vue'
import { useSheet } from '@/composables/useSheet'
import { lastMadeLabel, staleFirst } from '@/lib/dates'
import { suggestStaleMeals } from '@/lib/suggestions'
import { useListStore } from '@/stores/list'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import { useSettingsStore } from '@/stores/settings'

const meals = useMealsStore()
const plan = usePlanStore()
const list = useListStore()
const settings = useSettingsStore()
const { open } = useSheet()

const pickerOpen = ref(false)

/** Everything not already planned, most forgotten first. */
const unplanned = computed(() => meals.meals.filter((m) => !plan.isPlanned(m.id)).sort(staleFirst))

/** Up to three stale ideas worth reconsidering. */
const suggestions = computed(() =>
	suggestStaleMeals(meals.meals, plan.mealIds, {
		staleWeeks: settings.settings.staleWeeks,
		showSuggestions: settings.settings.showSuggestions,
	}),
)

const meta = computed(() => {
	const mealCount = plan.mealIds.length
	const itemCount = list.openItems.length

	return `${mealCount} meal${mealCount === 1 ? '' : 's'} · ${itemCount} item${itemCount === 1 ? '' : 's'}`
})

function subLine(mealId: string) {
	const meal = meals.get(mealId)
	if (!meal) return ''

	return [lastMadeLabel(meal.lastMadeAt), meal.tags.join(', ')].filter(Boolean).join(' · ')
}

async function addToPlan(id: string) {
	await plan.add(id)
	pickerOpen.value = false
}
</script>

<template>
	<PageHeader title="The plan" :meta="meta" />

	<div class="flex flex-col gap-6 px-4 pt-2 pb-6">
		<section class="flex flex-col gap-2.5">
			<PlannedMealCard
				v-for="meal in plan.plannedMeals"
				:key="meal.id"
				:meal="meal"
				@open="open('meal', meal.id)"
			/>

			<p v-if="!plan.mealIds.length" class="px-1 py-4 text-sm text-muted text-pretty">
				Nothing planned. Add a few options below and the shopping list fills itself.
			</p>
		</section>

		<section>
			<BaseButton
				variant="primary"
				block
				:disabled="!unplanned.length && !pickerOpen"
				@click="pickerOpen = !pickerOpen"
			>
				{{ pickerOpen ? 'Close' : 'Add a meal to the plan' }}
			</BaseButton>

			<div v-if="pickerOpen" class="mt-2.5 max-h-75 overflow-y-auto rounded-card bg-surface">
				<button
					v-for="(meal, index) in unplanned"
					:key="meal.id"
					type="button"
					class="flex min-h-11 w-full items-baseline gap-2.5 px-3 py-2.5 text-left"
					:class="{ 'border-t border-border': index > 0 }"
					@click="addToPlan(meal.id)"
				>
					<span class="flex-1 text-sm">{{ meal.name }}</span>
					<span class="flex-none text-micro tracking-[0.06em] text-subtle uppercase">
						{{ lastMadeLabel(meal.lastMadeAt) }}
					</span>
					<span class="flex-none font-heading text-base font-semibold text-accent">+</span>
				</button>

				<p v-if="!unplanned.length" class="px-3 py-4 text-sm text-muted">
					Everything you have saved is already planned.
				</p>
			</div>
		</section>

		<section v-if="suggestions.length">
			<div class="mb-2 flex items-baseline justify-between px-0.5">
				<h2 class="label-section">Been a while</h2>
				<span class="label-micro">{{ settings.settings.staleWeeks }}+ weeks</span>
			</div>

			<div class="flex flex-col gap-2">
				<div
					v-for="meal in suggestions"
					:key="meal.id"
					class="flex items-center gap-2.5 rounded-card bg-accent-soft px-3 py-2.5"
				>
					<button type="button" class="min-w-0 flex-1 text-left" @click="open('meal', meal.id)">
						<span class="block text-[17px] leading-tight font-heading font-semibold text-pretty">
							{{ meal.name }}
						</span>
						<span class="mt-0.5 block text-meta text-muted">{{ subLine(meal.id) }}</span>
					</button>

					<BaseButton class="min-h-9.5 flex-none bg-bg" @click="plan.add(meal.id)">
						Plan it
					</BaseButton>
				</div>
			</div>
		</section>
	</div>
</template>
