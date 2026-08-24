/*
The arithmetic behind dragging a row into a new position, kept out of the
component for the usual reason and one specific one: happy-dom reports every
rect and every offset as zero, so a test that mounts the editor and fires
pointer events cannot say anything at all about where a row would land. Here it
can, because the layout is an argument.

Everything below works in one coordinate space — pixels from the top of the
container the rows are laid out in.
*/

/** Where one row sits in the list as it is laid out right now. */
export interface Span {
	top: number
	height: number
}

/**
 * Move an item to a new index, returning a new array.
 *
 * `to` is clamped rather than rejected: the keyboard path is "this row, one
 * further down", and clamping means the ends of the list need no special case
 * at the call site.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
	const next = [...items]
	if (from < 0 || from >= next.length) return next

	const target = Math.min(Math.max(to, 0), next.length - 1)
	if (target === from) return next

	const [item] = next.splice(from, 1)
	next.splice(target, 0, item)

	return next
}

/**
 * Which slot the row being dragged should occupy, given where every row
 * currently sits and how far the dragged one has been dragged.
 *
 * The test is the dragged row's leading edge against the middle of the slot it
 * is moving into: its top for a move up, its bottom for a move down. Centre
 * against centre reads as the obvious rule and is wrong — a row taller than the
 * one above it can then never pass it at all, because its centre cannot be
 * brought level with the other's without dragging it off the top of the list.
 *
 * `spans` is the layout as it stands, and the dragged row still has a slot of
 * its own in it: it is only ever visually offset, never taken out of flow, so
 * nothing collapses under it and the heights stay honest even when one row is
 * taller for having its store picker open.
 *
 * The two comparisons are deliberately not both inclusive. They meet at exactly
 * the same pixel, so a tie satisfying each in turn would swap a row down and
 * back up forever; letting the upward one own the tie settles it.
 *
 * Both loops scan inwards from the ends rather than stepping one neighbour at a
 * time, so a fast drag past several rows lands where the finger is instead of
 * crawling after it.
 */
export function dropIndex(spans: readonly Span[], from: number, draggedTop: number): number {
	const self = spans[from]
	if (!self) return from

	const draggedBottom = draggedTop + self.height

	for (let i = 0; i < from; i++) {
		const span = spans[i]
		if (draggedTop <= span.top + span.height / 2) return i
	}

	for (let i = spans.length - 1; i > from; i--) {
		const span = spans[i]
		if (draggedBottom > span.top + span.height / 2) return i
	}

	return from
}
