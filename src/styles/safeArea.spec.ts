/*
Guards against a collision that is invisible until it ships.

`safe-top` and `safe-bottom` each set a padding property. Putting a second
utility for the SAME property on the same element (`safe-top` with `pt-4`, or
`safe-bottom` with `py-3`) means two rules compete, and whichever is generated
later in the stylesheet wins silently. That is how the header lost its top
padding and ended up jammed against the status bar.

The safe utilities already include the layout's own padding — tune it with
`--safe-top-base` / `--safe-bottom-base` rather than adding a padding utility.

Matching is done on whitespace-split tokens rather than regexes, deliberately:
an earlier version of this test used a word-boundary regex, got its backslash
eaten, and silently matched nothing while reporting success.
*/
import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Utilities that would fight each safe-area class for the same property. */
const CONFLICTS: Record<string, string[]> = {
	'safe-top': ['pt-', 'py-', 'p-'],
	'safe-bottom': ['pb-', 'py-', 'p-'],
}

/** Every class attribute in the file, including ones Prettier split over lines. */
function classAttributes(source: string): string[] {
	return [...source.matchAll(/class="([^"]*)"/g)].map((match) => match[1])
}

function tokensOf(attribute: string): string[] {
	return attribute.split(/\s+/).filter(Boolean)
}

const files = globSync('src/**/*.vue')

describe('safe-area utilities', () => {
	it('has Vue files to check', () => {
		// Without this, a broken glob would make every case below pass vacuously.
		expect(files.length).toBeGreaterThan(0)
	})

	it('token matching actually works', () => {
		const tokens = tokensOf('safe-top flex px-4 pt-4 pb-3')

		expect(tokens).toContain('safe-top')
		expect(tokens.some((t) => CONFLICTS['safe-top'].some((p) => t.startsWith(p)))).toBe(true)
		// px-4 must not be mistaken for a vertical padding utility.
		expect(['px-4'].some((t) => CONFLICTS['safe-top'].some((p) => t.startsWith(p)))).toBe(false)
	})

	it.each(Object.keys(CONFLICTS))('%s is never paired with a competing padding utility', (safe) => {
		const offenders: string[] = []

		for (const file of files) {
			for (const attribute of classAttributes(readFileSync(file, 'utf8'))) {
				const tokens = tokensOf(attribute)
				if (!tokens.includes(safe)) continue

				for (const token of tokens) {
					if (CONFLICTS[safe].some((prefix) => token.startsWith(prefix))) {
						offenders.push(`${file}: "${safe}" alongside "${token}"`)
					}
				}
			}
		}

		expect(offenders).toEqual([])
	})
})
