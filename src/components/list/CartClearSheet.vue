<script setup lang="ts">
/*
Confirms finishing a shopping trip.

Clearing the cart is destructive in an asymmetric way — one-offs are deleted
outright while everything else is only unchecked or shelved — so it spells out
exactly what will happen to each kind before doing it.
*/
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSheet from '@/components/ui/BaseSheet.vue'
import { useListStore } from '@/stores/list'

const open = defineModel<boolean>('open', { required: true })
const list = useListStore()

async function confirm() {
	await list.clearCart()
	open.value = false
}
</script>

<template>
	<BaseSheet v-model:open="open">
		<header class="flex-none border-b border-border px-4 pt-4 pb-3">
			<h2 class="text-sheet-title">Finish the trip?</h2>
		</header>

		<div class="flex-1 overflow-y-auto px-4 py-4">
			<ul class="flex flex-col gap-3">
				<li v-if="list.cartClearPlan.oneOffsToDelete.length">
					<p class="label-micro mb-1 text-danger">Deleted for good</p>
					<p class="text-sm text-muted">
						{{ list.cartClearPlan.oneOffsToDelete.map((i) => i.name).join(', ') }}
					</p>
				</li>

				<li v-if="list.cartClearPlan.staplesToShelve.length">
					<p class="label-micro mb-1">Back on the staples shelf</p>
					<p class="text-sm text-muted">
						{{ list.cartClearPlan.staplesToShelve.map((i) => i.name).join(', ') }}
					</p>
				</li>

				<li v-if="list.cartClearPlan.ingredientsToUncheck.length">
					<p class="label-micro mb-1">Just unchecked</p>
					<p class="text-sm text-muted">
						{{ list.cartClearPlan.ingredientsToUncheck.length }} meal
						{{
							list.cartClearPlan.ingredientsToUncheck.length === 1 ? 'ingredient' : 'ingredients'
						}}
						— still needed while their meals stay planned.
					</p>
				</li>
			</ul>
		</div>

		<footer class="safe-bottom flex flex-none gap-2 border-t border-border px-4 py-3">
			<BaseButton class="flex-1" @click="open = false">Cancel</BaseButton>
			<BaseButton variant="primary" class="flex-1" @click="confirm">Finish trip</BaseButton>
		</footer>
	</BaseSheet>
</template>
