<script setup lang="ts">
/*
The staples shelf: the things bought regularly, resting off the list until
tapped onto it.

Two modes, deliberately separated. Closed, it is a row of chips that put a
staple on this week's list — the one-tap thing done at the store. Open for
editing, it is where the shelf itself is maintained: new staples are typed in
here, and existing ones are deleted here.

Editing used to have no home at all. Staples could only be created through the
shopping input (which meant that input carried a Kind toggle for a decision
that almost never applies to what is being typed), and deleting one took a
four-step detour: put it on the list, un-pin it to a one-off, buy it, finish
the trip. Both of those now live on the shelf, where the shelf's contents are
what is actually being talked about.
*/
import { nextTick, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import { useListStore } from '@/stores/list'
import { STORE_LABELS, STORES, type Store } from '@/types'

const list = useListStore()

const open = ref(true)
const editing = ref(false)

const newName = ref('')
const newStore = ref<Store>('either')
const input = ref<HTMLInputElement | null>(null)

function toggleEditing() {
	if (editing.value) {
		editing.value = false
		newName.value = ''
		return
	}

	// Editing a collapsed section would look like the button did nothing.
	editing.value = true
	open.value = true
	nextTick(() => input.value?.focus())
}

async function addStaple() {
	if (!newName.value.trim()) return

	/*
	Lands on the shelf, not on the list: adding one here is defining something
	bought regularly, not saying it is needed today. Its chip is one tap away
	for that. "I need this now" is what the shopping input above is for, and
	the repeat control on any row promotes that item without retyping it.
	*/
	await list.addExtra(newName.value, newStore.value, { kind: 'staple', active: false })

	newName.value = ''
	// Adding one staple usually means adding several.
	input.value?.focus()
}
</script>

<template>
	<section>
		<div class="flex items-baseline gap-1 pb-2">
			<button
				type="button"
				class="flex flex-1 items-baseline justify-between gap-2 px-0.5 py-1"
				:aria-expanded="open"
				@click="open = !open"
			>
				<h2 class="label-section text-muted">Staples</h2>
				<span class="label-micro">
					{{ list.shelvedStaples.length }} off the list
					<FaIcon icon="chevron-down" :class="open ? 'rotate-180' : ''" class="ml-1" />
				</span>
			</button>

			<button
				type="button"
				class="label-micro flex-none px-2 py-1 text-accent"
				:aria-pressed="editing"
				@click="toggleEditing"
			>
				{{ editing ? 'Done' : 'Edit' }}
			</button>
		</div>

		<div v-if="open" class="flex flex-col gap-2">
			<!-- Editing: add to the shelf, and remove from it. -->
			<template v-if="editing">
				<div class="flex gap-2">
					<input
						ref="input"
						v-model="newName"
						class="input"
						placeholder="Add a staple"
						autocomplete="off"
						enterkeyhint="enter"
						@keydown.enter.prevent="addStaple"
					/>
					<BaseButton
						variant="primary"
						class="flex-none"
						:disabled="!newName.trim()"
						@click="addStaple"
					>
						<FaIcon icon="plus" />
						Add
					</BaseButton>
				</div>

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

				<p v-if="!list.allStaples.length" class="px-1 pt-1 text-meta text-subtle text-pretty">
					Nothing on the shelf yet. Anything added here comes back after every trip.
				</p>

				<div v-else class="overflow-hidden rounded-card bg-surface">
					<div v-for="staple in list.allStaples" :key="staple.id" class="list-row items-center">
						<span class="min-w-0 flex-1">
							<span class="block text-[15px] leading-snug">{{ staple.name }}</span>
							<span class="mt-0.5 block text-meta text-muted">
								{{ STORE_LABELS[staple.store] }}
								<template v-if="staple.active"> · on the list</template>
							</span>
						</span>

						<button
							type="button"
							class="btn btn-ghost btn-icon -my-2 -mr-1 w-11 flex-none text-danger"
							:aria-label="`Delete ${staple.name}`"
							@click="list.removeExtra(staple.id)"
						>
							<FaIcon icon="trash" class="text-xs" />
						</button>
					</div>
				</div>
			</template>

			<!-- Shopping: tap a staple onto this week's list. -->
			<template v-else>
				<p v-if="!list.allStaples.length" class="px-1 text-meta text-subtle text-pretty">
					Nothing here yet. Tap <em class="not-italic text-muted">Edit</em> to add one, or tap
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
			</template>
		</div>
	</section>
</template>
