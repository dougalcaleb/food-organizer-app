<script setup lang="ts">
/*
One meal in the plan.

Note the deliberate asymmetry between the two ways a meal leaves: "Remove"
takes it off the plan and touches nothing else, while "Made it" also stamps
last-made. Only cooking counts as history — changing your mind about the week
should not make a meal look freshly eaten.
*/
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlanStore } from '@/stores/plan'
import { STORE_LABELS, type Meal } from '@/types'

const props = defineProps<{ meal: Meal }>()
const emit = defineEmits<{ open: [] }>()

const plan = usePlanStore()

/** "6 ingredients · Costco, Walmart" — the distinct stores this meal touches. */
const summary = computed(() => {
	const count = props.meal.ingredients.length
	if (!count) return 'no ingredients yet'

	const stores = [...new Set(props.meal.ingredients.map((i) => i.store ?? 'wherever'))]
	const label = `${count} ingredient${count === 1 ? '' : 's'}`

	return `${label} · ${stores.map((s) => STORE_LABELS[s]).join(', ')}`
})
</script>

<template>
	<div class="card">
		<div class="flex items-baseline gap-2.5">
			<button
				type="button"
				class="flex-1 text-left text-card-title leading-tight text-pretty"
				@click="emit('open')"
			>
				{{ meal.name }}
			</button>
			<button
				type="button"
				class="flex-none py-1 text-meta tracking-[0.08em] text-subtle uppercase"
				@click="plan.remove(meal.id)"
			>
				Remove
			</button>
		</div>

		<p class="mt-1 text-meta text-muted text-pretty">{{ summary }}</p>

		<div class="mt-2.5 flex gap-2">
			<BaseButton class="min-h-9.5" @click="plan.markMade(meal.id)">Made it</BaseButton>
			<BaseButton variant="ghost" class="min-h-9.5" @click="emit('open')"> Ingredients </BaseButton>
		</div>
	</div>
</template>
