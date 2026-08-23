<script setup lang="ts">
/*
The buying view. Everything here except one-offs and staples is derived from
the plan — nothing on this screen is a list you maintain by hand.

Three kinds of line share it, and they behave differently once bought: see
CartClearSheet.
*/
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import SegControl from '@/components/ui/SegControl.vue'
import CartClearSheet from '@/components/list/CartClearSheet.vue'
import ShoppingRow from '@/components/list/ShoppingRow.vue'
import StapleShelf from '@/components/list/StapleShelf.vue'
import { extraIdFromKey } from '@/lib/shoppingList'
import { useListStore } from '@/stores/list'
import { STORE_LABELS, STORES, type ShopView, type Store } from '@/types'

const list = useListStore()

const views: { id: ShopView; label: string }[] = [
	{ id: 'store', label: 'By store' },
	{ id: 'meal', label: 'By meal' },
	{ id: 'all', label: 'All' },
]

const meta = computed(() => `${list.openItems.length} open · ${list.doneItems.length} in cart`)

/* ── Adding a one-off ───────────────────────────────────────────────────

This input makes one-offs and nothing else. It carried a Kind toggle once, so
every single thing typed at the store had to be told it was not a staple — a
decision that belongs to the shelf, and now lives there. Something typed here
that turns out to be recurring is promoted in place with the repeat control on
its row, and the store chips need no "Store" label now that they are the only
chips here.
*/

const newName = ref('')
const newStore = ref<Store>('costco')

async function addItem() {
	if (!newName.value.trim()) return

	await list.addExtra(newName.value, newStore.value)
	newName.value = ''
}

/** The stored extra behind a shopping row, if the row is an extra at all. */
function extraFor(key: string) {
	return list.extraById(extraIdFromKey(key))
}

/* ── Sections ─────────────────────────────────────────────────────────── */

const cartOpen = ref(true)
const confirmOpen = ref(false)
</script>

<template>
	<PageHeader title="Shopping list" :meta="meta" />

	<div class="px-4 pt-2 pb-3">
		<SegControl v-model="list.view" :options="views" />
	</div>

	<div class="flex flex-col gap-5 px-4 pb-6">
		<section v-for="group in list.groups" :key="group.title">
			<div class="mb-2 flex items-baseline justify-between px-0.5">
				<h2 class="label-section">{{ group.title }}</h2>
				<span class="label-micro">
					{{ group.items.length }} item{{ group.items.length === 1 ? '' : 's' }}
				</span>
			</div>

			<div class="overflow-hidden rounded-card bg-surface">
				<ShoppingRow
					v-for="item in group.items"
					:key="item.key"
					:item="item"
					:can-pin="!!extraFor(item.key)"
					:staple="extraFor(item.key)?.kind === 'staple'"
					@toggle="list.toggle(item.key)"
					@pin="list.toggleStaple(extraIdFromKey(item.key)!)"
				/>
			</div>
		</section>

		<p v-if="!list.groups.length" class="px-1 py-4 text-sm text-muted text-pretty">
			Nothing to buy. Plan a meal, or add an item below.
		</p>

		<!-- Add a one-off -->
		<section>
			<div class="flex gap-2">
				<input
					v-model="newName"
					class="input"
					placeholder="Add an item"
					autocomplete="off"
					enterkeyhint="enter"
					@keydown.enter.prevent="addItem"
				/>
				<BaseButton
					variant="primary"
					class="flex-none"
					:disabled="!newName.trim()"
					@click="addItem"
				>
					<FaIcon icon="plus" />
					Add
				</BaseButton>
			</div>

			<div class="mt-2 flex flex-wrap gap-1.5">
				<BaseChip
					v-for="store in STORES"
					:key="store"
					selectable
					:active="newStore === store"
					@click="newStore = store"
				>
					{{ STORE_LABELS[store] }}
				</BaseChip>
			</div>
		</section>

		<StapleShelf />

		<!-- In the cart -->
		<section v-if="list.doneItems.length">
			<button
				type="button"
				class="flex w-full items-baseline justify-between px-0.5 pb-2"
				@click="cartOpen = !cartOpen"
			>
				<h2 class="label-section text-muted">In the cart</h2>
				<span class="label-micro">
					{{ list.doneItems.length }}
					<FaIcon icon="chevron-down" :class="cartOpen ? 'rotate-180' : ''" class="ml-1" />
				</span>
			</button>

			<template v-if="cartOpen">
				<div class="overflow-hidden rounded-card bg-surface">
					<ShoppingRow
						v-for="item in list.doneItems"
						:key="item.key"
						:item="item"
						checked
						@toggle="list.toggle(item.key)"
					/>
				</div>

				<BaseButton class="mt-2 w-full" @click="confirmOpen = true">Finish trip</BaseButton>
			</template>
		</section>
	</div>

	<!-- Mounted unconditionally: BaseSheet does its own show/hide, and unmounting
	     on close would skip the sheet's exit animation. -->
	<CartClearSheet v-model:open="confirmOpen" />
</template>
