const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Whole weeks between `timestamp` and now. `null` (never made) reports
 * Infinity so it sorts as maximally stale — the whole point of the Ideas tab
 * is surfacing what you have not cooked.
 */
export function weeksSince(timestamp: number | null, now: number = Date.now()): number {
	if (timestamp === null) return Infinity
	return Math.max(0, Math.floor((now - timestamp) / MS_PER_WEEK))
}

/** The handoff's last-made label wording. */
export function weekLabel(weeks: number): string {
	if (!Number.isFinite(weeks)) return 'never made'
	if (weeks <= 0) return 'made this week'
	if (weeks === 1) return '1 week ago'
	if (weeks >= 52) return 'over a year ago'
	return `${weeks} weeks ago`
}

/** Convenience: the label for a meal's `lastMadeAt` directly. */
export function lastMadeLabel(lastMadeAt: number | null, now?: number): string {
	return weekLabel(weeksSince(lastMadeAt, now))
}

/*
Comparators for meal staleness.

These sort on `lastMadeAt` directly rather than on derived week counts, because
a never-made meal reports Infinity weeks and `Infinity - Infinity` is NaN — an
invalid comparator result, and not a rare case: jotting down name-only ideas is
a normal thing to do, so several never-made meals is the expected state.

Ties break on name so the order is stable and predictable rather than
dependent on insertion order.
*/

interface HasLastMade {
	name: string
	lastMadeAt: number | null
}

/** Most stale first. Never-made meals lead, since those are the most forgotten. */
export function staleFirst(a: HasLastMade, b: HasLastMade): number {
	if (a.lastMadeAt === b.lastMadeAt) return a.name.localeCompare(b.name)
	if (a.lastMadeAt === null) return -1
	if (b.lastMadeAt === null) return 1

	// An older timestamp means longer since it was made.
	return a.lastMadeAt - b.lastMadeAt
}

/** Most recently made first. Never-made meals sort last. */
export function recentFirst(a: HasLastMade, b: HasLastMade): number {
	return -staleFirst(a, b)
}
