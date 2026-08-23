/*
Guards a phone-only failure that no amount of DOM testing can reach.

Chrome on Android decides what the on-screen return key does. Left to itself it
labels it "Next" for a field with other fields after it and handles the press
natively — focus jumps to the next input in the document and no keydown is ever
dispatched. Every `@keydown.enter` handler in the app is therefore dead on the
device that matters: Enter in an ingredient row silently focused the Notes box
instead of adding a row.

`enterkeyhint="enter"` asks for a plain return, which does dispatch. So: an
input that handles Enter itself must say so.

There is no IME in happy-dom, so this is checked as text. Matching is on
whitespace-split attributes rather than a regex with escapes, for the reason
`styles/safeArea.spec.ts` explains.
*/
import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The text of every element that carries a `keydown.enter` handler. */
function enterHandlingTags(source: string): string[] {
	return [...source.matchAll(/<(input|textarea)\b[^>]*>/g)]
		.map((match) => match[0])
		.filter((tag) => tag.includes('keydown.enter'))
}

const files = globSync('src/**/*.vue')

describe('enter key handling', () => {
	it('has Vue files to check', () => {
		expect(files.length).toBeGreaterThan(0)
	})

	it('finds the handlers it is meant to check', () => {
		const found = files.flatMap((file) => enterHandlingTags(readFileSync(file, 'utf8')))

		// A tag-matcher broken by a reformat would otherwise pass vacuously.
		expect(found.length).toBeGreaterThan(0)
	})

	it('every input that handles Enter declares an enterkeyhint', () => {
		const offenders: string[] = []

		for (const file of files) {
			for (const tag of enterHandlingTags(readFileSync(file, 'utf8'))) {
				if (!tag.includes('enterkeyhint')) offenders.push(file)
			}
		}

		expect(offenders).toEqual([])
	})
})
