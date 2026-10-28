// ─── Stock projection ────────────────────────────────────────────────────────
// Runs stock forward day by day: it falls at the recent sales rate and jumps
// when a delivery lands. Pure — no I/O, no dates from the environment beyond the
// start day the caller passes in.
//
// The point of the curve is not the curve. It is the day the line hits zero, and
// whether a given shipping mode lands before that.

import { addDays, daysBetween } from '@/lib/inbound-calc'

export interface ProjectionProduct {
  id:          string
  units:       number   // on hand at startIso
  dailySales:  number   // units per day
}

export interface Restock {
  productId: string
  date:      string   // YYYY-MM-DD
  quantity:  number
  label?:    string   // e.g. the inbound's name, for the tooltip
}

export interface ProjectionPoint {
  date:      string
  byProduct: Record<string, number>
}

export interface ProjectionResult {
  points: ProjectionPoint[]
  /**
   * Day each product first reaches zero, or null when it does not inside the
   * window — either because nothing is selling or because a delivery covers it.
   */
  runsOutOn: Record<string, string | null>
}

/**
 * Stock is floored at zero: you cannot sell what you do not have, and a negative
 * line would suggest a backlog the data does not model. What the shortfall
 * actually costs is expressed by `runsOutOn` instead.
 */
export function projectStock({
  startIso,
  days,
  products,
  restocks = [],
}: {
  startIso:  string
  days:      number
  products:  ProjectionProduct[]
  restocks?: Restock[]
}): ProjectionResult {
  // Restocks bucketed by day offset, so several landing on one day all count.
  const byOffset = new Map<number, Restock[]>()
  for (const r of restocks) {
    const offset = daysBetween(startIso, r.date)
    if (offset < 0 || offset > days) continue   // outside the window
    const list = byOffset.get(offset) ?? []
    list.push(r)
    byOffset.set(offset, list)
  }

  const units: Record<string, number> = Object.fromEntries(
    products.map(p => [p.id, Math.max(0, p.units)]),
  )
  const runsOutOn: Record<string, string | null> = Object.fromEntries(
    products.map(p => [p.id, null]),
  )

  const points: ProjectionPoint[] = []

  for (let offset = 0; offset <= days; offset++) {
    const date = addDays(startIso, offset)

    // Deliveries land at the start of their day, before that day's sales.
    for (const r of byOffset.get(offset) ?? []) {
      if (units[r.productId] === undefined) continue
      units[r.productId] += r.quantity
    }

    if (offset > 0) {
      for (const p of products) {
        units[p.id] = Math.max(0, units[p.id] - Math.max(0, p.dailySales))
      }
    }

    for (const p of products) {
      if (units[p.id] <= 0 && runsOutOn[p.id] === null && p.dailySales > 0) {
        runsOutOn[p.id] = date
      }
    }

    points.push({ date, byProduct: { ...units } })
  }

  return { points, runsOutOn }
}

/** Stock on a given day, for the "will it still be there when this lands" line. */
export function unitsOn(result: ProjectionResult, productId: string, date: string): number | null {
  const point = result.points.find(p => p.date === date)
  return point ? point.byProduct[productId] ?? null : null
}
