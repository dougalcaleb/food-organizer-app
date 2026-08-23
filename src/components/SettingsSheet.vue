<script setup lang="ts">
/*
Settings, reached from the gear in the page header — the tab bar stays at
three. Also the home for the JSON backup, since IndexedDB is the only copy of
this data and the browser is allowed to evict it.
*/
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChip from '@/components/ui/BaseChip.vue'
import BaseSheet from '@/components/ui/BaseSheet.vue'
import SegControl from '@/components/ui/SegControl.vue'
import { downloadBackup, restoreBackup, BackupFormatError } from '@/db/backup'
import { useCloudBackup } from '@/composables/useCloudBackup'
import { storageEstimate } from '@/lib/storage'
import { useSettingsStore } from '@/stores/settings'
import { hydrateStores } from '@/stores'
import type { ShopView } from '@/types'

const open = defineModel<boolean>('open', { required: true })

const settings = useSettingsStore()

const shopViews: { id: ShopView; label: string }[] = [
	{ id: 'store', label: 'By store' },
	{ id: 'meal', label: 'By meal' },
	{ id: 'all', label: 'All' },
]

/* ── Tags ─────────────────────────────────────────────────────────────── */

const newTag = ref('')

function addTag() {
	const trimmed = newTag.value.trim()
	newTag.value = ''

	if (!trimmed || settings.settings.tags.includes(trimmed)) return
	void settings.update({ tags: [...settings.settings.tags, trimmed] })
}

/*
Unpinning, not deleting: meals keep the tag, so it simply drops back to being
one of the inferred ones rather than always leading the list.
*/
function removeTag(tag: string) {
	void settings.update({ tags: settings.settings.tags.filter((t) => t !== tag) })
}

/* ── Storage ──────────────────────────────────────────────────────────── */

const persisted = ref<boolean | null>(null)
const usage = ref<string | null>(null)

onMounted(async () => {
	persisted.value = (await navigator.storage?.persisted?.()) ?? null

	const estimate = await storageEstimate()
	if (estimate?.usage != null) {
		usage.value = `${(estimate.usage / 1024).toFixed(0)} KB`
	}
})

/* ── Backup ───────────────────────────────────────────────────────────── */

const fileInput = ref<HTMLInputElement | null>(null)
const restoreError = ref<string | null>(null)
const restoreBusy = ref(false)

/* ── Cloud backup ─────────────────────────────────────────────────────── */

// Destructured, so the template sees plain refs it can unwrap. Reaching through
// `cloud.status` would hand it a Ref object instead: auto-unwrapping only
// applies to setup's own top-level bindings, not to properties of an object.
const {
	configured: cloudConfigured,
	status: cloudStatus,
	message: cloudMessage,
	backUpNow,
	restoreFromCloud,
} = useCloudBackup()

const lastCloudBackup = computed(() => {
	const at = settings.settings.lastCloudBackupAt
	if (at == null) return null

	return new Date(at).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
})

async function onCloudRestore() {
	// Same bar as restoring a file — it replaces everything on this device.
	if (!window.confirm('Restoring replaces everything currently stored. Continue?')) return
	if (await restoreFromCloud()) open.value = false
}

async function onRestoreFile(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0]
	if (!file) return

	restoreError.value = null

	// Destructive and irreversible — the file replaces everything currently
	// stored, so make the user say so out loud.
	if (!window.confirm('Restoring replaces everything currently stored. Continue?')) {
		if (fileInput.value) fileInput.value.value = ''
		return
	}

	restoreBusy.value = true

	try {
		await restoreBackup(await file.text())
		await hydrateStores()
		open.value = false
	} catch (error) {
		restoreError.value =
			error instanceof BackupFormatError ? error.message : 'Could not restore that file.'
	} finally {
		restoreBusy.value = false
		if (fileInput.value) fileInput.value.value = ''
	}
}

/* ── Dev ──────────────────────────────────────────────────────────────── */

const isDev = import.meta.env.DEV

async function resetToSeed() {
	// The DEV check has to wrap the import itself, not just guard the call:
	// `import.meta.env.DEV` is replaced with `false` at build time, which lets
	// Rollup drop the whole block. Guarding only the caller would still pull the
	// 14 sample meals into the production bundle.
	if (!import.meta.env.DEV) return
	if (!window.confirm('Wipe everything and reinstate the sample meals?')) return

	const { reseed } = await import('@/db/seed')
	await reseed()
	await hydrateStores()
	open.value = false
}
</script>

<template>
	<BaseSheet v-model:open="open">
		<header class="flex flex-none items-start gap-3 border-b border-border px-4 pt-4 pb-3">
			<h2 class="flex-1 text-sheet-title">Settings</h2>
			<BaseButton icon aria-label="Close" @click="open = false">
				<FaIcon icon="xmark" />
			</BaseButton>
		</header>

		<div class="flex-1 overflow-y-auto px-4 py-4">
			<section class="mb-7">
				<p class="label-micro mb-2">Been a while after</p>
				<div class="flex items-center gap-3">
					<input
						:value="settings.settings.staleWeeks"
						class="input w-20 text-center"
						type="number"
						inputmode="numeric"
						min="4"
						max="40"
						@change="
							settings.update({ staleWeeks: Number(($event.target as HTMLInputElement).value) })
						"
					/>
					<span class="text-sm text-muted">weeks</span>
				</div>
				<p class="mt-2 text-meta text-subtle">
					How stale a meal has to be before Ideas emphasises it and Plan suggests it.
				</p>
			</section>

			<section class="mb-7">
				<p class="label-micro mb-2">Shopping list opens on</p>
				<SegControl
					:model-value="settings.settings.defaultShopView"
					:options="shopViews"
					@update:model-value="settings.update({ defaultShopView: $event })"
				/>
			</section>

			<section class="mb-7">
				<p class="label-micro mb-2">Pinned tags</p>
				<div v-if="settings.settings.tags.length" class="mb-2 flex flex-wrap gap-1.5">
					<BaseChip
						v-for="tag in settings.settings.tags"
						:key="tag"
						selectable
						:aria-label="`Unpin ${tag}`"
						@click="removeTag(tag)"
					>
						{{ tag }}
						<FaIcon icon="xmark" class="ml-1.5 text-[9px] text-subtle" />
					</BaseChip>
				</div>
				<input
					v-model="newTag"
					class="input"
					placeholder="Add a tag"
					autocomplete="off"
					enterkeyhint="enter"
					@keydown.enter.prevent="addTag"
				/>
				<p class="mt-2 text-meta text-subtle">
					These lead every tag list. Any other tag a meal carries is offered after them.
				</p>
			</section>

			<section class="mb-7">
				<label class="flex items-center justify-between gap-4">
					<span>
						<span class="block text-sm">Suggest forgotten meals</span>
						<span class="mt-0.5 block text-meta text-subtle">
							Shows the “been a while” block on the Plan tab.
						</span>
					</span>
					<input
						:checked="settings.settings.showSuggestions"
						type="checkbox"
						class="h-6 w-6 flex-none accent-accent"
						@change="
							settings.update({
								showSuggestions: ($event.target as HTMLInputElement).checked,
							})
						"
					/>
				</label>
			</section>

			<section class="mb-7 border-t border-border pt-6">
				<p class="label-micro mb-2">Backup</p>
				<p class="mb-3 text-meta text-subtle">
					Everything lives on this device only. Export regularly — clearing site data wipes it.
				</p>

				<div class="flex gap-2">
					<BaseButton class="flex-1" @click="downloadBackup()">Download</BaseButton>
					<BaseButton class="flex-1" :disabled="restoreBusy" @click="fileInput?.click()">
						{{ restoreBusy ? 'Restoring…' : 'Restore' }}
					</BaseButton>
				</div>

				<input
					ref="fileInput"
					type="file"
					accept="application/json,.json"
					class="hidden"
					@change="onRestoreFile"
				/>

				<p v-if="restoreError" class="mt-2 text-meta text-danger">{{ restoreError }}</p>

				<!--
						Hidden outright when the build carries no token. An unconfigured
						build — every plain `npm run dev` — should look exactly as it did
						before this feature existed rather than offer a dead button.
					-->
				<div v-if="cloudConfigured" class="mt-5 border-t border-border pt-5">
					<p class="label-micro mb-2">Cloud</p>
					<p class="mb-3 text-meta text-subtle">
						Backs itself up to AWS roughly once a week, on its own.
					</p>

					<div class="flex gap-2">
						<BaseButton class="flex-1" :disabled="cloudStatus === 'working'" @click="backUpNow()">
							{{ cloudStatus === 'working' ? 'Working…' : 'Back up now' }}
						</BaseButton>
						<BaseButton
							class="flex-1"
							:disabled="cloudStatus === 'working'"
							@click="onCloudRestore"
						>
							Restore
						</BaseButton>
					</div>

					<p v-if="cloudMessage" class="mt-2 text-meta text-danger">{{ cloudMessage }}</p>
					<p v-else class="mt-2 text-meta text-subtle">
						{{ lastCloudBackup ? `Last backed up ${lastCloudBackup}.` : 'Not backed up yet.' }}
					</p>
				</div>

				<!--
					Height is reserved because this resolves after mount, while the sheet
					is still animating in. A bottom-anchored panel that grows mid-flight
					shoves everything above it upward — the shift was the whole reason
					the settings sheet felt unsettled on open.
				-->
				<p class="mt-3 min-h-[2.9rem] text-meta text-subtle">
					<template v-if="persisted === true">
						Storage is marked persistent{{ usage ? ` · ${usage} used` : '' }}.
					</template>
					<template v-else-if="persisted === false">
						Storage is not persistent — the browser may evict it. Installing to the home screen
						usually earns persistence.
					</template>
				</p>
			</section>

			<section v-if="isDev" class="border-t border-border pt-6">
				<p class="label-micro mb-2">Developer</p>
				<BaseButton variant="danger" @click="resetToSeed">Reset to sample data</BaseButton>
			</section>
		</div>
	</BaseSheet>
</template>
