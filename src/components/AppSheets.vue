<script setup lang="ts">
/*
Single mount point for every sheet, driven by the `?sheet=` query param. Views
never mount a sheet themselves — they call `useSheet().open(...)`, which keeps
sheet state in the URL and therefore in the back stack.

Meal detail and the meal editor land here in step 5.
*/
import { useSheet } from '@/composables/useSheet'
import SettingsSheet from '@/components/SettingsSheet.vue'

const { openModel } = useSheet()
const settingsOpen = openModel('settings')
</script>

<template>
	<SettingsSheet v-if="settingsOpen" v-model:open="settingsOpen" />
</template>
