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
import { extraIdFromKey } from '@/lib/shoppingList'
import { useListStore } from '@/stores/list'
import { STORE_LABELS, STORES, type ExtraKind, type ShopView, type Store } from '@/types'

const list = useListStore()

const views: { id: ShopView; label: string }[] = [
	{ id: 'store', label: 'By store' },
	{ id: 'meal', label: 'By meal' },
	{ id: 'all', label: 'All' },
]

const meta = computed(() => `${list.openItems.length} open · ${list.doneItems.length} in cart`)

/* ── Adding a one-off ─────────────────────────────────────────────────── */

const newName = ref('')
const newStore = ref<Store>('costco')
const newKind = ref<ExtraKind>('oneoff')

const kinds: { id: ExtraKind; label: string }[] = [
	{ id: 'oneoff', label: 'One-off' },
	{ id: 'staple', label: 'Staple' },
]

async function addItem() {
	if (!newName.value.trim()) return

	await list.addExtra(newName.value, newStore.value, { kind: newKind.value })
	newName.value = ''
}

/** The stored extra behind a shopping row, if the row is an extra at all. */
function extraFor(key: string) {
	return list.extraById(extraIdFromKey(key))
}

/* ── Sections ─────────────────────────────────────────────────────────── */

const cartOpen = ref(true)
const shelfOpen = ref(true)
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

			<div class="mt-2 flex items-center gap-2">
				<span class="w-11 flex-none label-micro">Kind</span>
				<div class="flex flex-wrap gap-1.5">
					<BaseChip
						v-for="kind in kinds"
						:key="kind.id"
						selectable
						:active="newKind === kind.id"
						@click="newKind = kind.id"
					>
						{{ kind.label }}
					</BaseChip>
				</div>
			</div>

			<div class="mt-1.5 flex items-center gap-2">
				<span class="w-11 flex-none label-micro">Store</span>
				<div class="flex flex-wrap gap-1.5">
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
			</div>

			<p v-if="newKind === 'staple'" class="mt-2 text-meta text-subtle text-pretty">
				Staples return to the shelf after each trip.
			</p>
		</section>

		<!--
			Staples shelf. Always rendered, even when empty — hiding it made the whole
			feature look absent rather than unused.
		-->
		<section>
			<button
				type="button"
				class="flex w-full items-baseline justify-between px-0.5 pb-2"
				@click="shelfOpen = !shelfOpen"
			>
				<h2 class="label-section text-muted">Staples</h2>
				<span class="label-micro">
					{{ list.shelvedStaples.length }} off the list
					<FaIcon icon="chevron-down" :class="shelfOpen ? 'rotate-180' : ''" class="ml-1" />
				</span>
			</button>

			<div v-if="shelfOpen">
				<p v-if="!list.allStaples.length" class="px-1 text-meta text-subtle text-pretty">
					Nothing here yet. Add one above as a <em class="not-italic text-muted">Staple</em>, or tap
					<FaIcon icon="repeat" class="text-[10px] text-muted" />
					on any item.
				</p>

				<p v-else-if="!list.shelvedStaples.length" class="px-1 text-meta text-subtle">
					All on the list.
				</p>

				<div v-else class="flex flex-wrap gap-1.5">
					<BaseChip
						v-for="staple in list.shelvedStaples"
						:key="staple.id"
						selectable
						@click="list.setStapleActive(staple.id, true)"
					>
						<FaIcon icon="plus" class="mr-1.5 text-[9px] text-accent" />
						{{ staple.name }}
					</BaseChip>
				</div>
			</div>
		</section>

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
