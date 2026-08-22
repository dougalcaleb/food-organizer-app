<script setup lang="ts">
/*
One meal in the Ideas list. The last-made label is emphasised once a meal
crosses the stale threshold — that emphasis is the mechanism by which
forgotten ideas come back into view.
*/
import { computed } from 'vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import { lastMadeLabel, weeksSince } from '@/lib/dates'
import { usePlanStore } from '@/stores/plan'
import { useSettingsStore } from '@/stores/settings'
import type { Meal } from '@/types'

const props = defineProps<{ meal: Meal }>()

const plan = usePlanStore()
const settings = useSettingsStore()

const isStale = computed(() => weeksSince(props.meal.lastMadeAt) >= settings.settings.staleWeeks)
const label = computed(() => lastMadeLabel(props.meal.lastMadeAt))

const ingredientLine = computed(() => {
	const count = props.meal.ingredients.length
	if (!count) return 'no ingredients yet'
	return `${count} ingredient${count === 1 ? '' : 's'}`
})
</script>

<template>
	<button type="button" class="card w-full text-left">
		<div class="flex items-baseline gap-2.5">
			<h2 class="flex-1 text-card-title leading-tight text-pretty">{{ meal.name }}</h2>
			<span
				v-if="plan.isPlanned(meal.id)"
				class="flex-none text-micro tracking-[0.1em] text-accent uppercase"
			>
				Planned
			</span>
		</div>

		<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
			<span
				class="text-meta tracking-[0.06em] uppercase"
				:class="isStale ? 'border-b border-stale/40 text-stale' : 'text-subtle'"
			>
				{{ label }}
			</span>
			<span class="text-meta text-muted">{{ ingredientLine }}</span>
		</div>

		<div v-if="meal.tags.length" class="mt-2 flex flex-wrap gap-1.5">
			<BaseChip v-for="tag in meal.tags" :key="tag" soft>{{ tag }}</BaseChip>
		</div>
	</button>
</template>
