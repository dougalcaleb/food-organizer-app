import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/*
Sheets live in the query string rather than in routes.

The reason is the phone's back gesture: with the open sheet as a history
entry, back closes the sheet. Were the sheet component-local state, back would
leave the app entirely with the sheet still notionally open — the single most
annoying thing a mobile web app can do.

  ?sheet=settings
  ?sheet=meal&id=<mealId>
  ?sheet=editor&id=<mealId>   (omit id to create a new meal)
*/
export type SheetName = 'settings' | 'meal' | 'editor'

/**
 * How long a sheet takes to animate out. `AppSheets` keeps a closing sheet
 * mounted for exactly this long, and `BaseSheet` hands the same number to its
 * transition — a sheet unmounted the moment `?sheet=` clears simply vanishes.
 */
export const SHEET_EXIT_MS = 140

export const SHEET_NAMES: SheetName[] = ['settings', 'meal', 'editor']

function parseSheet(value: unknown): SheetName | null {
	return SHEET_NAMES.includes(value as SheetName) ? (value as SheetName) : null
}

export function useSheet() {
	const route = useRoute()
	const router = useRouter()

	const current = computed(() => parseSheet(route.query.sheet))
	const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : undefined))

	const isOpen = computed(() => current.value !== null)

	/** Returns the navigation promise, so callers can await the transition. */
	function open(sheet: SheetName, sheetId?: string) {
		return router.push({
			query: { ...route.query, sheet, ...(sheetId ? { id: sheetId } : { id: undefined }) },
		})
	}

	/**
	 * Prefer going back, so closing a sheet consumes the history entry that
	 * opening it created rather than stacking another one. Falls back to a
	 * replace when the sheet was opened from a cold load (a shared or reloaded
	 * URL), where there is nothing to go back to.
	 */
	function close(): Promise<unknown> {
		if (window.history.state?.back) {
			router.back()
			return Promise.resolve()
		}

		const query = { ...route.query }
		delete query.sheet
		delete query.id
		return router.replace({ query })
	}

	/** Two-way binding for components that take a v-model:open. */
	function openModel(sheet: SheetName) {
		return computed({
			get: () => current.value === sheet,
			set: (value: boolean) => {
				if (!value && current.value === sheet) void close()
			},
		})
	}

	return { current, id, isOpen, open, close, openModel }
}
