<script setup lang="ts">
/*
Single mount point for every sheet, driven by the `?sheet=` query param. Views
never mount a sheet themselves — they call `useSheet().open(...)`, which keeps
sheet state in the URL and therefore in the back stack.

Every sheet name in `SheetName` must have a component here — a name with no
component silently pushes a history entry and renders nothing.

Mounting is deliberately not the same thing as being open. `?sheet=` clears the
instant the back gesture fires, and unmounting there cut every closing
animation dead, so a closed sheet lingers for `SHEET_EXIT_MS` with `open` false
— long enough for `BaseSheet` to animate it out. The id it was opened with is
frozen for the same reason: letting it clear mid-flight would blank the sheet's
contents while the panel was still on screen.
*/
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { SHEET_EXIT_MS, useSheet, type SheetName } from '@/composables/useSheet'
import SettingsSheet from '@/components/SettingsSheet.vue'
import MealDetailSheet from '@/components/meal/MealDetailSheet.vue'
import MealEditorSheet from '@/components/meal/MealEditorSheet.vue'

const { current, id, openModel } = useSheet()

const settingsOpen = openModel('settings')
const editorOpen = openModel('editor')
const detailOpen = openModel('meal')

/*
Both this timer and the transition's own start on the same tick, but the
transition's starts fractionally later — so matching SHEET_EXIT_MS exactly lets
this one win the race and yank the sheet a frame before it has finished
leaving. The buffer is short enough to be invisible and long enough to lose.
*/
const UNMOUNT_BUFFER_MS = 60

const timers = new Set<ReturnType<typeof setTimeout>>()

/** True while the sheet is open, and for its exit animation afterwards. */
function useMounted(open: Ref<boolean>) {
	const mounted = ref(open.value)
	let timer: ReturnType<typeof setTimeout> | undefined

	watch(open, (isOpen) => {
		if (timer) {
			clearTimeout(timer)
			timers.delete(timer)
		}

		if (isOpen) {
			mounted.value = true
			return
		}

		timer = setTimeout(() => {
			mounted.value = false
		}, SHEET_EXIT_MS + UNMOUNT_BUFFER_MS)
		timers.add(timer)
	})

	return mounted
}

const settingsMounted = useMounted(settingsOpen)
const editorMounted = useMounted(editorOpen)
const detailMounted = useMounted(detailOpen)

/*
The id as of the last time a sheet was opened — including undefined, which is
how the editor is asked for a brand new meal.
*/
const shownId = ref(id.value)
watch([current, id], ([sheet, value]: [SheetName | null, string | undefined]) => {
	if (sheet) shownId.value = value
})

onBeforeUnmount(() => {
	for (const timer of timers) clearTimeout(timer)
	timers.clear()
})
</script>

<template>
	<SettingsSheet v-if="settingsMounted" v-model:open="settingsOpen" />
	<MealEditorSheet v-if="editorMounted" v-model:open="editorOpen" :meal-id="shownId" />
	<MealDetailSheet v-if="detailMounted" v-model:open="detailOpen" :meal-id="shownId" />
</template>
