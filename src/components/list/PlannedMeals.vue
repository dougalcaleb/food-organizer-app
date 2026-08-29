<script setup lang="ts">
/*
The planned meals, as things you shop FOR rather than things already on the
list.

Being planned no longer puts a meal's ingredients on the shopping list. It used
to, and the failure was structural: the plan is a rolling set of meals you mean
to cook, held for as long as you still mean to, which is routinely longer than
the gap between shopping trips. Its ingredients were therefore re-derived onto
the list every week and bought again every week, and the only way to stop that
was to take a meal out of a plan you had not cooked yet.

So a meal reaches the list explicitly, from here, and buying it releases the
pull — see the list store's clearCart. A tap takes everything the meal needs; a
hold opens its ingredients, for the usual case where half of them are already in
the cupboard.

A tap on a meal already fully on the list takes it all back off, which is the
undo for a mis-tap. There is no separate remove control: the row is the toggle.
A partly-added meal completes rather than clears, because "add what is missing"
is what a second tap on a half-added meal is asking for.
*/
import { computed, ref } from 'vue'
import PlannedMealRow from '@/components/list/PlannedMealRow.vue'
import { useListStore } from '@/stores/list'
import { usePlanStore } from '@/stores/plan'
import type { Meal } from '@/types'

const plan = usePlanStore()
const list = useListStore()

const open = ref(true)
/** Meal ids whose ingredient picker is showing. */
const expanded = ref(new Set<string>())

/** How much of each planned meal is currently on the list. */
const rows = computed(() =>
	plan.plannedMeals.map((meal) => {
		const pulled = plan.pulledNames(meal.id)
		const total = meal.ingredients.length
		const on = meal.ingredients.filter((i) => pulled.includes(i.name.trim().toLowerCase())).length

		return { meal, pulled, total, on, all: total > 0 && on === total }
	}),
)

/** What the header counts: meals with something still to put on the list. */
const toAdd = computed(() => rows.value.filter((r) => !r.all).length)

function meta(row: (typeof rows.value)[number]): string {
	if (!row.total) return 'no ingredients yet'
	if (row.all) return `all ${row.total} on the list`
	if (!row.on) return `${row.total} ingredient${row.total === 1 ? '' : 's'}`
	return `${row.on} of ${row.total} on the list`
}

function toggleExpanded(mealId: string) {
	const next = new Set(expanded.value)
	if (!next.delete(mealId)) next.add(mealId)
	expanded.value = next
}

/*
Every path that can take an ingredient back off the list sweeps the checked keys
behind it. Without that, an ingredient checked off and then removed leaves its
key behind, and the next meal needing that ingredient puts it straight into the
cart — which in a shop means walking past it.
*/
async function toggleAll(row: (typeof rows.value)[number]) {
	if (!row.total) return

	if (row.all) {
		await plan.dropPull(row.meal.id)
		await list.clearOrphanedChecked()
		return
	}

	await plan.pullAll(row.meal)
}

async function toggleOne(meal: Meal, name: string) {
	const wasPulled = plan.isPulled(meal.id, name)
	await plan.togglePulled(meal.id, name)
	if (wasPulled) await list.clearOrphanedChecked()
}
</script>

<template>
	<section>
		<button
			type="button"
			class="flex w-full items-baseline justify-between gap-2 px-0.5 py-1 pb-2"
			:aria-expanded="open"
			@click="open = !open"
		>
			<h2 class="label-section text-muted">From the plan</h2>
			<span class="label-micro">
				<template v-if="rows.length">{{ toAdd }} to add</template>
				<FaIcon icon="chevron-down" :class="open ? 'rotate-180' : ''" class="ml-1" />
			</span>
		</button>

		<div v-if="open" class="flex flex-col gap-2">
			<p v-if="!rows.length" class="px-1 text-meta text-subtle text-pretty">
				Nothing planned. Meals added on the Plan tab show up here, ready to put on the list.
			</p>

			<template v-else>
				<div class="overflow-hidden rounded-card bg-surface">
					<PlannedMealRow
						v-for="row in rows"
						:key="row.meal.id"
						:meal="row.meal"
						:pulled="row.pulled"
						:meta="meta(row)"
						:expanded="expanded.has(row.meal.id)"
						@tap="toggleAll(row)"
						@hold="toggleExpanded(row.meal.id)"
						@pick="toggleOne(row.meal, $event)"
					/>
				</div>

				<p class="px-1 text-meta text-subtle text-pretty">
					Tap a meal to add everything it needs. Hold one to pick ingredients.
				</p>
			</template>
		</div>
	</section>
</template>
