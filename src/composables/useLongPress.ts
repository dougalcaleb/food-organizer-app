import { ref } from 'vue'

/*
Press-and-hold, for the one editing affordance on the shopping list.

Why a gesture and not a button: the shopping row deliberately has no tap target
covering its words (see `list/ShoppingRow.vue`), because a stray tap there
checks something off and that error is only noticed at home. A hold cannot be
made by accident, and it adds nothing to the row to aim at or miss.
*/

/** Long enough not to be a tap, short enough not to feel stuck. iOS uses ~500ms. */
export const LONG_PRESS_MS = 450

/** A press that travels further than this is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 10

export function useLongPress(onLongPress: () => void) {
	let timer: ReturnType<typeof setTimeout> | undefined
	let origin: { x: number; y: number } | undefined

	/*
	True from the moment the hold fires until the press that produced it is
	fully over. The browser still sends a `click` on release, so any handler
	underneath — the checkbox most of all — has to be able to ask whether the
	click it just got was really the end of a hold.
	*/
	const fired = ref(false)

	function cancel() {
		if (timer !== undefined) clearTimeout(timer)
		timer = undefined
		origin = undefined
	}

	function pointerdown(event: PointerEvent) {
		// A right-click has its own menu, and a hold with it means nothing.
		if (event.pointerType === 'mouse' && event.button !== 0) return

		cancel()
		// A previous hold that ended over inert text never had a click to
		// consume it; the next press is where that gets cleared.
		fired.value = false
		origin = { x: event.clientX, y: event.clientY }

		timer = setTimeout(() => {
			timer = undefined
			fired.value = true
			// The only confirmation a hold gets — nothing has moved yet.
			navigator.vibrate?.(8)
			onLongPress()
		}, LONG_PRESS_MS)
	}

	function pointermove(event: PointerEvent) {
		if (!origin) return

		const travelled =
			Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE_PX ||
			Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE_PX

		if (travelled) cancel()
	}

	function contextmenu(event: Event) {
		// Chrome on Android raises this at its own ~500ms, just after ours; left
		// alone it puts selection handles over the row we have just opened.
		if (timer !== undefined || fired.value) event.preventDefault()
	}

	/**
	 * Whether the click now being handled is only the release of a hold, and
	 * should therefore do nothing. Consumes the flag, so it answers once.
	 */
	function consumeClick(): boolean {
		if (!fired.value) return false

		fired.value = false
		return true
	}

	/** Spread onto the element with `v-on`. */
	const handlers = {
		pointerdown,
		pointermove,
		pointerup: cancel,
		pointercancel: cancel,
		pointerleave: cancel,
		contextmenu,
	}

	return { handlers, consumeClick }
}
