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
