/*
Where a dragged row lands.

This is the whole of the drag that can be tested: happy-dom has no layout, so
every `offsetTop` and every rect it reports is zero and a test that mounts the
editor and fires pointer events would agree with any implementation at all.
Here the layout is an argument, so the interesting cases — a drag past several
rows at once, rows of different heights, and reaching the ends of the list —
are all reachable.
*/
import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem, type Span } from './dragSort'

/** Three rows of 50px, as the editor lays them out with nothing expanded. */
const even: Span[] = [
	{ top: 0, height: 50 },
	{ top: 50, height: 50 },
	{ top: 100, height: 50 },
]

/** The middle row with its store picker open, so it is twice the height. */
const uneven: Span[] = [
	{ top: 0, height: 50 },
	{ top: 50, height: 100 },
	{ top: 150, height: 50 },
]

/** The list as it would be laid out after a move — heights in the new order. */
function relayout(spans: readonly Span[], from: number, to: number): Span[] {
	let top = 0

	return moveItem(spans, from, to).map((span) => {
		const placed = { top, height: span.height }
		top += span.height
		return placed
	})
}

describe('moveItem', () => {
	it('moves an item down', () => {
		expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
	})

	it('moves an item up', () => {
		expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
	})

	it('leaves the list alone when the item is already there', () => {
		expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
	})

	it('clamps a target past either end, so the keyboard path needs no bounds', () => {
		expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
		expect(moveItem(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b'])
	})

	it('never mutates the list it was given', () => {
		const items = ['a', 'b', 'c']
		moveItem(items, 0, 2)

		expect(items).toEqual(['a', 'b', 'c'])
	})
})

describe('dropIndex', () => {
	it('keeps the row where it is until its edge passes a neighbour', () => {
		expect(dropIndex(even, 0, 0)).toBe(0)
		// Its bottom edge has not reached the middle of the row below.
		expect(dropIndex(even, 0, 24)).toBe(0)
	})

	it('takes the next slot once that edge is past the middle of it', () => {
		expect(dropIndex(even, 0, 26)).toBe(1)
	})

	it('takes the slot the finger is actually over, not the next one along', () => {
		// A flick to the bottom of the list should not crawl a row per frame.
		expect(dropIndex(even, 0, 100)).toBe(2)
	})

	it('reaches the first slot from the last, where the drag can go no higher', () => {
		// The caller holds the row inside the list, so the top of the list is as
		// far up as a drag ever gets. Both ends have to be reachable from there.
		expect(dropIndex(even, 2, 0)).toBe(0)
	})

	it('reaches the last slot from the first', () => {
		expect(dropIndex(even, 0, 100)).toBe(2)
	})

	it('lets a tall row past a shorter one above it', () => {
		// The row with its picker open is 100px against the top row's 50, so its
		// centre can never be brought level with the top row's from inside the
		// list. Its top edge can: it is over the top row's middle at 25.
		expect(dropIndex(uneven, 1, 26)).toBe(1)
		expect(dropIndex(uneven, 1, 24)).toBe(0)
		expect(dropIndex(uneven, 1, 0)).toBe(0)
	})

	it('makes a short row cover half of a tall one before it passes it', () => {
		// The tall middle row's middle is at 100, so the top row has to be dragged
		// 50px — its own height — before its bottom edge is over it.
		expect(dropIndex(uneven, 0, 49)).toBe(0)
		expect(dropIndex(uneven, 0, 51)).toBe(1)
	})

	it('holds still where the row was picked up, whatever the heights', () => {
		for (const [index, span] of uneven.entries()) {
			expect(dropIndex(uneven, index, span.top)).toBe(index)
		}
	})

	/*
	The one property that cannot be seen from a single call: a move must not
	satisfy the condition for moving straight back. The two comparisons meet at
	the same pixel, so if both included the tie a row held exactly on a boundary
	would swap up and down for as long as it was held there — sixty times a
	second, since the drag is driven from a frame loop.
	*/
	it('never wants to undo the move it just made', () => {
		for (const spans of [even, uneven]) {
			for (const from of spans.keys()) {
				for (let top = 0; top <= 200; top++) {
					const to = dropIndex(spans, from, top)
					if (to === from) continue

					expect(dropIndex(relayout(spans, from, to), to, top)).toBe(to)
				}
			}
		}
	})

	it('does not move a row it cannot find', () => {
		expect(dropIndex(even, 5, 0)).toBe(5)
		expect(dropIndex([], 0, 0)).toBe(0)
	})
})
