// Stock is flagged when the quantity on hand covers fewer than this many days
// of average sales.
//
// The per-SKU reorder_threshold is deliberately not part of this rule. An
// absolute minimum quantity says nothing on its own — 50 units is comfortable
// for a slow mover and nearly out for a fast one. Days of coverage folds the
// sales rate in, so one number works across the whole catalogue.
export const COVERAGE_WARNING_DAYS = 60

/** Bar fill in percent, measuring days of coverage against the warning line. */
export function coverageFill(daysLeft: number | null): number {
  if (daysLeft === null) return 0
  return Math.min(100, (daysLeft / COVERAGE_WARNING_DAYS) * 100)
}

/** True when this SKU runs out inside the warning window. */
export function isLowStock(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft < COVERAGE_WARNING_DAYS
}

// ─── Effective stock ─────────────────────────────────────────────────────────

export interface WeShipUnits { on_stock: number; outgoing: number }

/**
 * The quantity actually available to sell.
 *
 * WeShip is the warehouse that ships, so its number leads; `outgoing` is already
 * committed to orders on the way out and is therefore subtracted. Shopify's
 * inventory_quantity is the fallback for a SKU WeShip does not carry.
 *
 * Was written out inline in both the overview and the inventory page; it lives
 * here so the two, and the inventory API route, cannot drift apart.
 */
export function effectiveUnits(weship: WeShipUnits | null | undefined, shopifyUnits: number): number {
  return weship != null ? weship.on_stock - weship.outgoing : shopifyUnits
}

/** Whole days of cover left, or null when nothing is selling. */
export function daysOfCover(units: number, avgDailySales: number): number | null {
  return avgDailySales > 0 ? Math.floor(units / avgDailySales) : null
}

/** The day stock reaches zero at the current rate, ignoring any restock. */
export function stockLastsUntil(units: number, avgDailySales: number, from = new Date()): Date | null {
  const days = daysOfCover(units, avgDailySales)
  return days === null ? null : new Date(from.getTime() + days * 86_400_000)
}
