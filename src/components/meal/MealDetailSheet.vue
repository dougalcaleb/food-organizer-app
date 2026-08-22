<script setup lang="ts">
/*
The meal detail sheet, opened from any meal title.

Notes are deliberately loose prose — no numbered steps, no timings, no
structured recipe format. The handoff is explicit about this and it matches how
the app is meant to be used: a reminder to yourself, not a recipe card.
*/
import { computed, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import BaseSheet from '@/components/ui/BaseSheet.vue'
import { useSheet } from '@/composables/useSheet'
import { lastMadeLabel } from '@/lib/dates'
import { fmtQty } from '@/lib/quantities'
import { useMealsStore } from '@/stores/meals'
import { usePlanStore } from '@/stores/plan'
import { STORE_LABELS, type Ingredient } from '@/types'

const props = defineProps<{ mealId?: string }>()
const open = defineModel<boolean>('open', { required: true })

const meals = useMealsStore()
const plan = usePlanStore()
const { open: openSheet } = useSheet()

const meal = computed(() => (props.mealId ? meals.get(props.mealId) : undefined))

/*
A stale link, or the meal being deleted from underneath us, would otherwise
leave an empty sheet stuck open with no way to tell what happened.
*/
watch(
	meal,
	(value) => {
		if (open.value && !value) open.value = false
	},
	{ immediate: true },
)

const isPlanned = computed(() => (meal.value ? plan.isPlanned(meal.value.id) : false))

function quantityOf(ingredient: Ingredient): string {
	return fmtQty(ingredient.amount, ingredient.unit)
}

async function addToPlan() {
	if (meal.value) await plan.add(meal.value.id)
}

async function removeFromPlan() {
	if (meal.value) await plan.remove(meal.value.id)
}

/** The only action that records history — drops from the plan AND stamps last-made. */
async function markMade() {
	if (!meal.value) return
	await plan.markMade(meal.value.id)
	open.value = false
}

function edit() {
	if (meal.value) openSheet('editor', meal.value.id)
}
</script>

<template>
	<BaseSheet v-if="meal" v-model:open="open">
		<header class="flex-none border-b border-border px-4 pt-4 pb-3">
			<div class="flex items-start gap-3">
				<h2 class="flex-1 text-sheet-title leading-tight text-pretty">{{ meal.name }}</h2>
				<BaseButton icon aria-label="Edit meal" @click="edit">
					<FaIcon icon="pen" />
				</BaseButton>
				<BaseButton icon aria-label="Close" @click="open = false">
					<FaIcon icon="xmark" />
				</BaseButton>
			</div>

			<div class="mt-2.5 flex flex-wrap gap-1.5">
				<BaseChip v-for="tag in meal.tags" :key="tag" active>{{ tag }}</BaseChip>
				<BaseChip soft>{{ lastMadeLabel(meal.lastMadeAt) }}</BaseChip>
			</div>
		</header>

		<div class="flex-1 overflow-y-auto px-4 py-4">
			<p class="label-micro mb-2">Ingredients</p>

			<div v-if="meal.ingredients.length" class="overflow-hidden rounded-card bg-surface">
				<div
					v-for="(ingredient, index) in meal.ingredients"
					:key="`${ingredient.name}-${index}`"
					class="flex items-baseline gap-2.5 px-3 py-2"
					:class="{ 'border-t border-border': index > 0 }"
				>
					<span class="flex-1 text-sm">{{ ingredient.name }}</span>
					<span
						v-if="quantityOf(ingredient)"
						class="flex-none font-heading text-[13px] font-semibold whitespace-nowrap text-accent"
					>
						{{ quantityOf(ingredient) }}
					</span>
					<span
						class="w-16 flex-none text-right text-micro tracking-[0.06em] text-subtle uppercase"
					>
						{{ STORE_LABELS[ingredient.store ?? 'wherever'] }}
					</span>
				</div>
			</div>

			<p v-else class="text-sm text-muted">
				No ingredients yet.
				<button type="button" class="text-accent underline underline-offset-2" @click="edit">
					Add some
				</button>
				— or leave it as an idea.
			</p>

			<p class="label-micro mt-6 mb-2">Notes</p>
			<p v-if="meal.notes" class="text-sm leading-relaxed text-muted text-pretty">
				{{ meal.notes }}
			</p>
			<p v-else class="text-sm text-subtle">Nothing written down.</p>
		</div>

		<footer class="safe-bottom flex flex-none gap-2 border-t border-border px-4 py-3">
			<template v-if="isPlanned">
				<BaseButton class="flex-1" @click="removeFromPlan">Remove from plan</BaseButton>
				<BaseButton variant="primary" class="flex-none" @click="markMade">Made it</BaseButton>
			</template>
			<BaseButton v-else variant="primary" class="flex-1" @click="addToPlan"
				>Add to plan</BaseButton
			>
		</footer>
	</BaseSheet>
</template>
