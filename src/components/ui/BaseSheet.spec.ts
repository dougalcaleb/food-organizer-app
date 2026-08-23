/*
Guards the last frame of a sheet's exit.

A CSS animation with no fill mode reverts the element to its base style the
instant it ends. The sheet is still in the DOM at that point — Vue removes it on
its own timer, a frame or two later — so the panel snapped back to fully open
and bright before vanishing. It read as a flicker at the end of every close.

So: every rule that animates something out has to hold its final frame.

This checks the stylesheet as text rather than by rendering, because jsdom
implements no animations at all: mounting the sheet would prove nothing.
*/
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SHEET_EXIT_MS } from '@/composables/useSheet'

const source = readFileSync('src/components/ui/BaseSheet.vue', 'utf8')

/** The bodies of every `.sheet-leave-active …` rule, keyed by their selector. */
function leaveRules(css: string): Record<string, string> {
	const rules: Record<string, string> = {}

	for (const match of css.matchAll(/(\.sheet-leave-active[^{}]*)\{([^}]*)\}/g)) {
		rules[match[1].trim()] = match[2]
	}

	return rules
}

/** Either the `animation` shorthand or the longhand can carry the fill mode. */
function holdsFinalFrame(body: string): boolean {
	const shorthand = body.match(/animation:\s*([^;]*)/)

	// `animation: none` is the reduced-motion opt-out: nothing runs, so there is
	// no final frame to hold.
	if (shorthand && shorthand[1].trim() === 'none') return true

	if (/animation-fill-mode:\s*(forwards|both)/.test(body)) return true

	return shorthand ? /\b(forwards|both)\b/.test(shorthand[1]) : false
}

describe('sheet exit animation', () => {
	const rules = leaveRules(source)

	it('finds the leave rules', () => {
		// Without this, a parser that matched nothing would pass every case below.
		expect(Object.keys(rules).length).toBeGreaterThan(0)
	})

	it('detects a rule that would flicker', () => {
		expect(holdsFinalFrame('animation: sheet-up 220ms ease reverse;')).toBe(false)
		expect(holdsFinalFrame('animation: sheet-up 220ms ease reverse forwards;')).toBe(true)
		expect(
			holdsFinalFrame('animation: sheet-up 220ms ease reverse;\nanimation-fill-mode: forwards;'),
		).toBe(true)
	})

	it.each(Object.keys(leaveRules(source)))('%s holds its final frame', (selector) => {
		expect(holdsFinalFrame(rules[selector])).toBe(true)
	})

	it('never animates out for longer than the mount is held', () => {
		// SHEET_EXIT_MS is what keeps a closing sheet mounted; an animation longer
		// than it would simply be cut off.
		const durations = Object.values(rules).flatMap((body) =>
			[...body.matchAll(/animation:[^;]*?(\d+)ms/g)].map((match) => Number(match[1])),
		)

		expect(durations.length).toBeGreaterThan(0)
		expect(Math.max(...durations)).toBeLessThanOrEqual(SHEET_EXIT_MS)
	})
})
