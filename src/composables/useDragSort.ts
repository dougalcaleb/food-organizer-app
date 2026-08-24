import { nextTick, onScopeDispose, ref } from 'vue'
import { dropIndex, type Span } from '@/lib/dragSort'

/*
Drag-to-reorder for a vertical list of rows, driven from a handle.

Three decisions worth knowing before changing anything here:

  - The dragged row is never taken out of flow. It keeps its slot and is moved
    with a transform, so the list's own layout stays measurable — `dropIndex`
    reads real heights, and a row that is taller for having its store picker
    open behaves like the tall thing it is.

  - The gesture starts on `pointerdown` on the handle, with no hold first.
    That is the opposite of `useLongPress`, and the difference is that a handle
    is a target you had to aim at: there is nothing to disambiguate, and making
    someone wait half a second on a control that does one thing reads as lag.
    The handle needs `touch-none` for it, or the browser claims the same drag
    for scrolling before the first move event arrives.

  - The drag listens on the window, not on the handle, and does not use
    `setPointerCapture`. See the note in `start`: both of the obvious ways to
    keep the gesture attached to the handle come apart precisely because the
    handle is inside the row being dragged.
*/

/** How long the row takes to settle into its slot once the finger lifts. */
export const DROP_SETTLE_MS = 140

/** Dragging within this of the scroller's edge scrolls the list. */
const EDGE_PX = 56

/** Fastest the edge scroll goes, at the very edge. */
const MAX_SCROLL_PX_PER_FRAME = 14

export interface DragSortOptions {
	/** Reorder the underlying list. Called as the row passes each slot. */
	move: (from: number, to: number) => void
	/** The scrolling ancestor, if the list can be longer than the screen. */
	scroller?: () => HTMLElement | null | undefined
}

export function useDragSort(options: DragSortOptions) {
	/** Slot of the row under the finger, or -1 when nothing is being dragged. */
	const index = ref(-1)
	/** Pixels the dragged row is displaced from its slot. */
	const offset = ref(0)
	/** True while the row travels the last few pixels after release. */
	const settling = ref(false)

	let container: HTMLElement | null = null
	/** The finger or button doing the dragging; a second one is ignored. */
	let pointer: number | undefined
	/** Where in the row the finger landed, so it stays under the same point. */
	let grabOffset = 0
	let pointerY = 0
	let frame: number | undefined
	let settleTimer: ReturnType<typeof setTimeout> | undefined

	/** Viewport y as a distance down the container. */
	function localY(clientY: number): number {
		return container ? clientY - container.getBoundingClientRect().top : 0
	}

	/*
	`offsetTop` rather than a rect, deliberately: it is the row's layout
	position and ignores the transform we are applying to it, so nothing below
	has to unpick our own displacement to find out where a row would sit if we
	let go of it.
	*/
	function spans(): Span[] {
		if (!container) return []

		return [...container.children].map((child) => ({
			top: (child as HTMLElement).offsetTop,
			height: (child as HTMLElement).offsetHeight,
		}))
	}

	/** Where the dragged row wants to be, kept inside the list. */
	function desiredTop(self: Span): number {
		const limit = Math.max(0, (container?.clientHeight ?? 0) - self.height)
		return Math.min(Math.max(localY(pointerY) - grabOffset, 0), limit)
	}

	/** Displace the row so the point it was grabbed by is under the finger. */
	function place(list = spans()): number | undefined {
		const self = list[index.value]
		if (!self) return undefined

		const top = desiredTop(self)
		offset.value = top - self.top

		return top
	}

	function update() {
		const list = spans()
		const top = place(list)
		if (top === undefined) return

		const to = dropIndex(list, index.value, top)
		if (to === index.value) return

		options.move(index.value, to)
		index.value = to

		/*
		The row's own slot has just moved out from under it, so the offset that
		was keeping it under the finger is stale by exactly one move. `nextTick`
		runs after the DOM is patched and still before the browser paints, so
		re-measuring there costs nothing visible rather than showing a jump.
		Only the offset is redone — running all of `update` again would recurse,
		and with rows of different heights it could do so without ever settling.
		The next frame carries the row on if the finger is still ahead of it.
		*/
		void nextTick(() => place())
	}

	/**
	 * Drag near the top or bottom of the scroller and the list comes to you.
	 * Without this a list longer than the sheet can only be reordered as far as
	 * the screen reaches, which for ingredients is most of the interesting moves.
	 */
	function autoScroll() {
		const scroller = options.scroller?.()
		if (!scroller) return

		const box = scroller.getBoundingClientRect()
		const fromTop = pointerY - box.top
		const fromBottom = box.bottom - pointerY

		if (fromTop < EDGE_PX) scroller.scrollTop -= speed(EDGE_PX - fromTop)
		else if (fromBottom < EDGE_PX) scroller.scrollTop += speed(EDGE_PX - fromBottom)
	}

	/** Ramps up as the finger nears the edge, so a nudge is not a lurch. */
	function speed(depth: number): number {
		return Math.min(depth / EDGE_PX, 1) * MAX_SCROLL_PX_PER_FRAME
	}

	/*
	Everything is driven from the frame loop rather than from `pointermove`,
	which only records where the finger is. Moves arrive in bursts and can
	outrun the layout, and the edge scroll has to keep running while the finger
	is held still at the edge sending no move events at all.
	*/
	function tick() {
		if (index.value === -1) return

		autoScroll()
		update()
		frame = requestAnimationFrame(tick)
	}

	function onMove(event: PointerEvent) {
		if (event.pointerId !== pointer) return

		pointerY = event.clientY
	}

	function onEnd(event: PointerEvent) {
		if (event.pointerId !== pointer) return

		stop()
	}

	/** Begin a drag. Bind to `pointerdown` on the handle inside a row. */
	function start(event: PointerEvent) {
		// A right-click drags nothing, and has its own menu.
		if (event.pointerType === 'mouse' && event.button !== 0) return

		const handle = event.currentTarget as HTMLElement | null
		const row = handle?.closest<HTMLElement>('[data-sortable]')
		const parent = row?.parentElement
		if (!handle || !row || !parent) return

		stop(true)

		container = parent
		pointer = event.pointerId
		index.value = [...parent.children].indexOf(row)
		pointerY = event.clientY
		grabOffset = localY(event.clientY) - row.offsetTop
		offset.value = 0

		/*
		On the window, and with no `setPointerCapture` — both of which look like
		the wrong choice until you notice that the handle is inside the thing
		being dragged.

		Listening on the handle alone works only while the pointer is over it,
		and it stops being over it the moment a drag outruns the row by more
		than the handle's own height, which a flick does immediately: the row
		freezes mid-list and comes back to life if you wander over the handle
		again. Capture is the documented answer to that, and it does not survive
		this drag either — a reorder moves the row in the DOM, the capturing
		element is briefly out of the document, and the capture is dropped
		silently at the first swap.

		The window sees every move in both cases. The one thing capture would
		have added is that the release lands on the handle; without it the
		release lands wherever the cursor is, which is harmless here because a
		`click` is only dispatched to the common ancestor of press and release,
		and no ancestor of these rows has a click handler.
		*/
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onEnd)
		window.addEventListener('pointercancel', onEnd)

		frame = requestAnimationFrame(tick)
	}

	/**
	 * End the drag. The row stays lifted for the settle, so it travels the last
	 * few pixels into its slot instead of snapping there — `immediate` is for
	 * teardown, where there is nobody to show it to.
	 */
	function stop(immediate = false) {
		if (frame !== undefined) cancelAnimationFrame(frame)
		if (settleTimer !== undefined) clearTimeout(settleTimer)

		window.removeEventListener('pointermove', onMove)
		window.removeEventListener('pointerup', onEnd)
		window.removeEventListener('pointercancel', onEnd)

		frame = undefined
		settleTimer = undefined
		pointer = undefined
		container = null
		offset.value = 0

		if (immediate || index.value === -1) {
			settling.value = false
			index.value = -1
			return
		}

		settling.value = true
		settleTimer = setTimeout(() => {
			settling.value = false
			index.value = -1
		}, DROP_SETTLE_MS)
	}

	onScopeDispose(() => stop(true))

	return { index, offset, settling, start }
}
