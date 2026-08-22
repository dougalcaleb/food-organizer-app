/**
 * Render an amount with its unit. Unitless amounts render bare, so a countable
 * ingredient reads "3" rather than "3 ".
 */
export function fmtQty(amount: number, unit: string): string {
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
 */
export function sumQuantities(parts: readonly { amount: number; unit: string }[]): string {
	const byUnit = new Map<string, number>()

	for (const { amount, unit } of parts) {
		byUnit.set(unit, (byUnit.get(unit) ?? 0) + amount)
	}

	return [...byUnit.entries()].map(([unit, amount]) => fmtQty(amount, unit)).join(' + ')
}
