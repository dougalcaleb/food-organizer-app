/*
Guards the sheet's exit animation.

Three traps, all of which showed up as "the close looks wrong" and none of which
jsdom can reproduce — it implements no animations at all, so mounting the sheet
would prove nothing. Everything here reads the stylesheet as text.

1. A CSS animation with no fill mode reverts the element to its base style the
   instant it ends. The sheet is still in the DOM at that point — Vue removes it
   on its own timer, a frame or two later — so the panel snapped back to fully
   open and bright before vanishing. It read as a flicker at the end of every
   close.

2. An exit is judged on its first frame. A curve that starts flat spends a beat
   doing nothing visible, and gets reported as a slow animation — at a duration
   that is not slow. `leavesImmediately` is the check that matters most here.

3. `animation-direction: reverse` reverses the timing function along with the
   keyframes, so the curve on a reversed rule is the mirror of what it reads as.
   The exits are written forwards now for exactly that reason, but the checks
   below still un-mirror a reversed rule rather than trusting the text, so
   reintroducing `reverse` cannot quietly slip a flat start past them.
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

type Bezier = [number, number, number, number]

/** The CSS keywords, as the béziers they are defined to be. */
const KEYWORDS: Record<string, Bezier> = {
	linear: [0, 0, 1, 1],
	ease: [0.25, 0.1, 0.25, 1],
	'ease-in': [0.42, 0, 1, 1],
	'ease-out': [0, 0, 0.58, 1],
	'ease-in-out': [0.42, 0, 0.58, 1],
}

const TIMING_FUNCTION = new RegExp(
	`cubic-bezier\\([^)]*\\)|\\b(?:${Object.keys(KEYWORDS).join('|')})\\b`,
)

function bezier(timing: string): Bezier | null {
	if (timing in KEYWORDS) return KEYWORDS[timing]

	const points = timing.match(/cubic-bezier\(([^)]*)\)/)
	if (!points) return null

	const values = points[1].split(',').map((n) => Number(n.trim()))
	return values.length === 4 && values.every(Number.isFinite) ? (values as Bezier) : null
}

/** A curve played backwards is its own reflection through the diagonal. */
function reflect([x1, y1, x2, y2]: Bezier): Bezier {
	return [1 - x2, 1 - y2, 1 - x1, 1 - y1]
}

/**
 * How fast the animation is moving on its first frame, as a multiple of its
 * average speed. Below 1 it is dawdling out of the gate.
 *
 * The first control point sets the tangent; when it sits exactly on the origin
 * the tangent runs to the second one instead.
 */
function initialSlope([x1, y1, x2, y2]: Bezier): number {
	if (x1 > 0) return y1 / x1
	if (y1 > 0) return Infinity
	return x2 > 0 ? y2 / x2 : Infinity
}

/** The one `.sheet-<direction>-active .sheet-<child>` rule's animation. */
function animation(direction: 'enter' | 'leave', child: 'panel' | 'backdrop') {
	const rule = source.match(
		new RegExp(`\\.sheet-${direction}-active \\.sheet-${child}\\s*\\{([^}]*)\\}`),
	)
	if (!rule) return null

	const value = rule[1].match(/animation:\s*([^;]*)/)?.[1]
	if (!value) return null

	const duration = value.match(/(\d+)ms/)
	const timing = value.match(TIMING_FUNCTION)?.[0]
	if (!duration || !timing) return null

	const curve = bezier(timing)
	if (!curve) return null

	// Read the curve as it will actually render, not as it is written.
	return {
		duration: Number(duration[1]),
		curve: /\breverse\b/.test(value) ? reflect(curve) : curve,
	}
}

const children = ['panel', 'backdrop'] as const

describe('sheet exit animation', () => {
	const rules = leaveRules(source)

	it('finds the leave rules', () => {
		// Without this, a parser that matched nothing would pass every case below.
		expect(Object.keys(rules).length).toBeGreaterThan(0)
	})

	it('detects a rule that would flicker', () => {
		expect(holdsFinalFrame('animation: sheet-down 140ms ease;')).toBe(false)
		expect(holdsFinalFrame('animation: sheet-down 140ms ease forwards;')).toBe(true)
		expect(
			holdsFinalFrame('animation: sheet-down 140ms ease;\nanimation-fill-mode: forwards;'),
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

	it.each(children)('parses both directions of the %s', (child) => {
		// The cases below are only meaningful if the rules were found at all.
		expect(animation('enter', child)).not.toBeNull()
		expect(animation('leave', child)).not.toBeNull()
	})

	it.each(children)('closes the %s faster than it opens it', (child) => {
		expect(animation('leave', child)!.duration).toBeLessThan(animation('enter', child)!.duration)
	})

	it('knows a lazy start from a prompt one', () => {
		// A curve that leaves at or above its average speed, and two that do not.
		expect(initialSlope([0.25, 0.6, 0.65, 0.95])).toBeGreaterThan(1)
		expect(initialSlope(KEYWORDS['ease-out'])).toBeGreaterThan(1)
		expect(initialSlope(KEYWORDS['ease-in'])).toBe(0)
		expect(initialSlope(KEYWORDS['ease'])).toBeLessThan(1)

		// And the reversed rule this replaced, which reads fast and renders flat.
		expect(initialSlope(reflect([0.22, 0.8, 0.36, 1]))).toBe(0)
	})

	/*
	The complaint both earlier versions drew, from opposite directions: the sheet
	"hangs around before leaving". An exit has no settling to do — it is going
	away — so any flatness at the start is dead time the eye reads as lag, and
	shortening the duration does not fix it.
	*/
	it.each(children)('starts the %s moving on the first frame', (child) => {
		expect(initialSlope(animation('leave', child)!.curve)).toBeGreaterThanOrEqual(1)
	})
})
