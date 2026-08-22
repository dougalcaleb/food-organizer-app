<script setup lang="ts">
/*
Single mount point for every sheet, driven by the `?sheet=` query param. Views
never mount a sheet themselves — they call `useSheet().open(...)`, which keeps
sheet state in the URL and therefore in the back stack.

Meal detail lands here next.
*/
import { useSheet } from '@/composables/useSheet'
import SettingsSheet from '@/components/SettingsSheet.vue'
import MealEditorSheet from '@/components/meal/MealEditorSheet.vue'

const { id, openModel } = useSheet()
const settingsOpen = openModel('settings')
const editorOpen = openModel('editor')
</script>

<template>
	<SettingsSheet v-if="settingsOpen" v-model:open="settingsOpen" />
	<MealEditorSheet v-if="editorOpen" v-model:open="editorOpen" :meal-id="id" />
</template>
