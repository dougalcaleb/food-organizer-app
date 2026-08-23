<script setup lang="ts">
/*
Dev-only. Every component class in every state, on one page, so the design
language can be retuned by editing `styles/theme.css` and watching this reload
— rather than by hunting states across three tabs.

Not registered in production builds (see router/index.ts).
*/
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'

const seg = ref('store')
const segOptions = [
	{ id: 'store', label: 'By store' },
	{ id: 'meal', label: 'By meal' },
	{ id: 'all', label: 'All' },
]

const activeChips = ref<string[]>(['Quick'])
const chips = ['Quick', 'Weekend project', 'Dinner', 'Thai', 'Italian']

function toggleChip(tag: string) {
	activeChips.value = activeChips.value.includes(tag)
		? activeChips.value.filter((t) => t !== tag)
		: [...activeChips.value, tag]
}

const roleSwatches = [
	['bg', 'bg-bg'],
	['surface', 'bg-surface'],
	['surface-raised', 'bg-surface-raised'],
	['surface-sunken', 'bg-surface-sunken'],
	['accent', 'bg-accent'],
	['accent-strong', 'bg-accent-strong'],
	['accent-muted', 'bg-accent-muted'],
	['accent-soft', 'bg-accent-soft'],
	['stale', 'bg-stale'],
	['danger', 'bg-danger'],
	['border', 'bg-border'],
	['border-strong', 'bg-border-strong'],
]

const textRoles = [
	['content', 'text-content'],
	['muted', 'text-muted'],
	['subtle', 'text-subtle'],
	['faint', 'text-faint'],
	['accent', 'text-accent'],
]
</script>

<template>
	<PageHeader title="Styleguide" meta="tuning surface" />

	<div class="flex flex-col gap-8 px-4 pb-12">
		<section>
			<h2 class="label-section mb-3">Surface roles</h2>
			<div class="grid grid-cols-2 gap-2">
				<div v-for="[name, cls] in roleSwatches" :key="name" class="flex items-center gap-2">
					<span class="h-8 w-8 flex-none rounded-control border border-border" :class="cls" />
					<code class="font-mono text-meta text-muted">{{ name }}</code>
				</div>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Text roles</h2>
			<p v-for="[name, cls] in textRoles" :key="name" :class="cls">
				{{ name }} — the quick brown fox jumps over the lazy dog
			</p>
		</section>

		<section>
			<h2 class="label-section mb-3">Type scale</h2>
			<p class="text-page-title">Page title · 30</p>
			<p class="text-sheet-title font-heading font-semibold">Sheet title · 25</p>
			<p class="text-card-title font-heading font-semibold">Card title · 19</p>
			<p class="label-section">Section header · 16</p>
			<p class="text-base">Body · 15</p>
			<p class="text-meta text-muted">Meta line · 11</p>
			<p class="label-micro">Micro label · 10</p>
		</section>

		<section>
			<h2 class="label-section mb-3">Buttons</h2>
			<div class="flex flex-wrap items-center gap-2">
				<button class="btn btn-primary">Add to plan</button>
				<button class="btn btn-secondary">Made it</button>
				<button class="btn btn-ghost">Ingredients</button>
				<button class="btn btn-danger">Delete</button>
				<button class="btn btn-primary" disabled>Disabled</button>
				<button class="btn btn-secondary btn-icon" aria-label="Close">
					<FaIcon icon="xmark" />
				</button>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Input</h2>
			<div class="flex gap-2">
				<input class="input" placeholder="Add a one-off item" />
				<button class="btn btn-primary flex-none">
					<FaIcon icon="plus" />
					Add
				</button>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Segmented control</h2>
			<div class="seg">
				<button
					v-for="opt in segOptions"
					:key="opt.id"
					class="seg-opt"
					:class="{ 'seg-opt-active': seg === opt.id }"
					@click="seg = opt.id"
				>
					{{ opt.label }}
				</button>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Chips</h2>
			<div class="flex flex-wrap gap-1.5">
				<button
					v-for="tag in chips"
					:key="tag"
					class="chip"
					:class="{ 'chip-active': activeChips.includes(tag) }"
					@click="toggleChip(tag)"
				>
					{{ tag }}
				</button>
			</div>
			<div class="mt-2 flex flex-wrap gap-1.5">
				<span v-for="tag in chips" :key="tag" class="chip chip-soft">{{ tag }}</span>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Card &amp; list rows</h2>
			<div class="card mb-3">
				<div class="flex items-baseline gap-2">
					<h3 class="flex-1 text-card-title">Weeknight red curry</h3>
					<span class="text-micro tracking-[0.1em] text-accent uppercase">Planned</span>
				</div>
				<p class="mt-1.5 text-meta text-subtle uppercase tracking-[0.06em]">
					2 weeks ago · 6 ingredients
				</p>
			</div>

			<div class="overflow-hidden rounded-card bg-surface">
				<!-- The checkbox is the only tap target; the words beside it are inert. -->
				<div v-for="n in 3" :key="n" class="list-row items-stretch gap-0">
					<button
						type="button"
						class="-my-2.5 -ml-3 flex w-11 flex-none items-start justify-center self-stretch pt-3"
					>
						<span class="h-[18px] w-[18px] flex-none rounded-[5px] border border-subtle" />
					</button>
					<div class="min-w-0 flex-1">
						<span class="flex items-baseline gap-2">
							<span class="flex-1 text-[15px]">coconut milk</span>
							<span class="font-heading text-sm font-semibold text-accent">3 cans</span>
						</span>
						<span class="mt-0.5 block text-meta text-muted">Weeknight red curry</span>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2 class="label-section mb-3">Radii</h2>
			<div class="flex flex-wrap gap-3">
				<div
					v-for="r in ['rounded-card', 'rounded-control', 'rounded-chip', 'rounded-sheet']"
					:key="r"
					class="flex h-16 w-24 items-center justify-center bg-surface-raised text-micro text-muted"
					:class="r"
				>
					{{ r.replace('rounded-', '') }}
				</div>
			</div>
		</section>
	</div>
</template>
