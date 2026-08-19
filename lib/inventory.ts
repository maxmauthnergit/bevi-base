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
