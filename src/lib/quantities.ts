/**
 * Render an amount with its unit. Everything is optional: an ingredient with
 * no amount renders as just its unit ("jar"), and one with neither renders as
 * nothing at all, so the row shows a name and no quantity.
 */
export function fmtQty(amount?: number, unit?: string): string {
	if (amount == null) return unit ?? ''

	// Avoid floating-point tails on values like 1.5 lb.
	const rounded = Math.round(amount * 100) / 100
	return unit ? `${rounded} ${unit}` : String(rounded)
}

/**
 * Sum amounts within each matching unit, then join the groups with " + ".
 *
 * Two meals wanting 2 cans and 1 can give "3 cans"; a meal wanting 1 lb plus
 * one wanting an unitless 2 gives "1 lb + 2", because those cannot be added.
 * Unit order follows first appearance.
 *
 * Unquantified parts contribute nothing to the sum — one meal asking for
 * "2 cans" and another just for "coconut milk" still reads "2 cans". A group
 * with no amounts at all falls back to its bare unit, and an item that is
 * entirely unquantified yields an empty string.
 */
export function sumQuantities(parts: readonly { amount?: number; unit?: string }[]): string {
	const byUnit = new Map<string, { total: number; quantified: boolean }>()

	for (const { amount, unit } of parts) {
		const key = unit ?? ''
		const group = byUnit.get(key) ?? { total: 0, quantified: false }

		if (amount != null) {
			group.total += amount
			group.quantified = true
		}

		byUnit.set(key, group)
	}

	return [...byUnit.entries()]
		.map(([unit, { total, quantified }]) => (quantified ? fmtQty(total, unit) : unit))
		.filter(Boolean)
		.join(' + ')
}
