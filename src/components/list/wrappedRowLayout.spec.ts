/*
Guards the layout rules in the two shopping-list rows that nothing in a test
environment can measure, because neither jsdom nor happy-dom implements layout.
Each was a real bug that reads as a styling accident.

First, the rule that lets a `.list-row` carry a second flex line — the
ingredient picker under a planned meal, and the store picker under a shopping
row.

A flex container breaks lines on each item's HYPOTHETICAL main size, and
`flex-1` means `flex-basis: 0`. So a `flex-1` child and a `w-full` panel "fit"
on one line together: the panel takes the full width, the child meant to hold
the text is squeezed to a few characters, and the panel is drawn straight over
it. The two rows avoid that in different ways, and neither is obvious from
reading the class list, so both are pinned here.

  ShoppingRow      its fixed `w-11` checkbox and pin columns push the line
                   over 100% on their own, which is what makes the `flex-1`
                   text column between them safe.
  PlannedMealRow   has no fixed column — one full-width button — so the
                   button itself has to be `w-full`.

PlannedMealRow also has to keep its padding on its children. Padding on the row
plus negative margins on a child is the usual way to make a tap target reach a
row's edges, and it is wrong the moment the row wraps: the negative margin makes
the child's margin box smaller than its border box, so it overflows its own flex
line and the next line is drawn over its last line of text. ShoppingRow gets
away with the same trick only because its negative-margin child is an 18px
checkbox that never fills its line.

Second, a flex item's baseline comes from its own content, so a box whose
content changes cannot be baseline-aligned without moving — and the ingredient
checkboxes were empty when unticked and held an <svg> when ticked. Both halves
are needed: the box sits out of the baseline (`self-start`), and its content
stops changing at all (the tick is always rendered, only its opacity moves), so
nothing about checking one can reach the layout in any engine.
*/
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Every class attribute in the file, including ones Prettier split over lines. */
function classAttributes(file: string): string[] {
	const source = readFileSync(file, 'utf8')
	return [...source.matchAll(/class="([^"]*)"/g)].map((match) => match[1])
}

function tokensOf(attribute: string): string[] {
	return attribute.split(/\s+/).filter(Boolean)
}

const PLANNED = 'src/components/list/PlannedMealRow.vue'
const SHOPPING = 'src/components/list/ShoppingRow.vue'

/** The class attribute of the wrapping row itself. */
function wrappingRow(file: string): string[] {
	const rows = classAttributes(file).filter((a) => tokensOf(a).includes('flex-wrap'))
	expect(rows).toHaveLength(1)
	return tokensOf(rows[0])
}

/**
 * The classes on the element whose opening tag carries `marker`. Nesting is
 * what matters here and a class attribute on its own cannot show it, so each
 * element of the wrapping row is addressed by something only it has.
 */
function elementWith(file: string, marker: string): string[] {
	const tags = [...readFileSync(file, 'utf8').matchAll(/<[a-z][^>]*?>/gis)].map((m) => m[0])
	const found = tags.filter((tag) => tag.includes(marker))

	expect(found).toHaveLength(1)

	const attribute = /class="([^"]*)"/.exec(found[0])
	expect(attribute).not.toBeNull()
	return tokensOf(attribute![1])
}

describe('PlannedMealRow', () => {
	it('gives the row its two full-width children, so the picker wraps below', () => {
		// The tap target. `flex-1` here is the bug: a zero hypothetical width
		// leaves room for the panel on the same line.
		const button = elementWith(PLANNED, '@click="onTap"')
		expect(button).toContain('w-full')
		expect(button).not.toContain('flex-1')

		const panel = elementWith(PLANNED, 'v-if="expanded && meal.ingredients.length"')
		expect(panel).toContain('w-full')
	})

	it('keeps the row padding on the children rather than clawing it back', () => {
		expect(wrappingRow(PLANNED)).toContain('p-0')

		const negatives = classAttributes(PLANNED).filter((a) =>
			tokensOf(a).some((token) => token.startsWith('-m')),
		)

		expect(negatives).toEqual([])
	})
})

describe('checkboxes that change content', () => {
	/*
	Only the boxes that gain a tick matter. A row aligning its text on a shared
	baseline is right — it is the box next to that text, whose own baseline moves
	when it fills, that has to sit out.
	*/
	it('the ingredient box aligns to the top of its line, not to the baseline', () => {
		const row = elementWith(PLANNED, '@click="onPick(ing.name)"')
		const box = elementWith(
			PLANNED,
			"isPulled(ing.name) ? 'border-accent bg-accent text-on-accent' : 'border-subtle'",
		)

		// The names and their amounts do share a baseline, and should.
		expect(row).toContain('items-baseline')

		// The box must not, and must not be nudged by a transform either — that
		// was the fudge covering for the moving baseline.
		expect(box).toContain('self-start')
		expect(box.filter((t) => t.startsWith('translate-y'))).toEqual([])
	})

	it('the ingredient tick is always rendered, so the box never changes size', () => {
		// Addressed by slicing rather than by a regex, on the house rule: a
		// backslash does not survive a heredoc, and the word-boundary escape this
		// wanted arrived as a backspace and matched nothing while reporting green.
		const source = readFileSync(PLANNED, 'utf8')
		const start = source.indexOf('<FaIcon', source.indexOf('@click="onPick(ing.name)"'))
		expect(start).toBeGreaterThan(-1)

		const tick = source.slice(start, source.indexOf('>', start))
		expect(tick).toContain('icon="check"')

		// A `v-if` here empties the box in one state and gives it an <svg> child
		// in the other, which is the geometry change the opacity toggle avoids.
		expect(tick).not.toContain('v-if')
		expect(tick).toContain('opacity-0')
	})

	it('the meal box is on a row that never used the baseline at all', () => {
		expect(elementWith(PLANNED, '@click="onTap"')).toContain('items-start')
	})
})

describe('ShoppingRow', () => {
	it('keeps the fixed columns that make its flexible one safe', () => {
		const attributes = classAttributes(SHOPPING)

		expect(wrappingRow(SHOPPING)).toContain('list-row')

		// The checkbox and the repeat control. Their fixed width is the only
		// reason the text column between them can be `flex-1` at all.
		const fixed = attributes.filter((a) => {
			const tokens = tokensOf(a)
			return tokens.includes('w-11') && tokens.includes('flex-none')
		})

		expect(fixed.length).toBeGreaterThanOrEqual(2)
	})
})
