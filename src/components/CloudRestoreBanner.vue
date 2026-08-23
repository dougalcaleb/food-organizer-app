<script setup lang="ts">
/*
Shown only in the situation the cloud backup exists for: this device has no
meals on it, but the service is holding a backup. That is either a fresh
install on a second device or — the case that matters — IndexedDB having been
evicted out from under the user.

It sits above the tab bar, not at the top of the shell: up there its own
safe-area inset would stack on top of PageHeader's and leave a dead band under
the status bar.

It is an offer and never automatic. Restoring replaces everything, and a
launch-time overwrite that guessed wrong would be the worst bug this app could
have; the empty-database guard in `lib/cloudBackup.ts` is the other half of the
same caution.
*/
import BaseButton from '@/components/ui/BaseButton.vue'
import { useCloudBackup } from '@/composables/useCloudBackup'

const { restoreOffered, status, message, restoreFromCloud, dismissRestoreOffer } = useCloudBackup()
</script>

<template>
	<div v-if="restoreOffered" class="flex-none border-t border-border bg-surface-raised px-4 py-3">
		<p class="text-sm">There is a backup stored for this app.</p>
		<p class="mt-0.5 text-meta text-subtle">
			Nothing is saved on this device. Restore it, or dismiss this to start fresh.
		</p>

		<p v-if="message" class="mt-2 text-meta text-danger">{{ message }}</p>

		<!--
			The Ideas view floats its "+" one page margin above the tab bar, which is
			exactly where this strip now is, so the button row keeps that corner clear.
		-->
		<div class="mt-3 flex gap-2 pe-[calc(var(--fab-size)+1rem)]">
			<BaseButton variant="primary" :disabled="status === 'working'" @click="restoreFromCloud()">
				{{ status === 'working' ? 'Restoring…' : 'Restore' }}
			</BaseButton>
			<BaseButton variant="ghost" @click="dismissRestoreOffer">Dismiss</BaseButton>
		</div>
	</div>
</template>
