// ─── Inbound calculator ──────────────────────────────────────────────────────
// Plans a future goods order: when does it land at WeShip, and what does it
// cost. Pure functions, no I/O — the page and the API routes both use these.
//
// Every duration is a min/max range, so the result is an arrival BAND rather
// than a single date. The quotes this is based on disagree by 10-15 days per
// mode; pretending otherwise would just hide the risk.

import type { ProductCostConfig } from '@/lib/costs-config'
import type { ShipMode } from '@/lib/inbounds'
import { SHIP_MODES, INBOUND_PRODUCTS } from '@/lib/inbounds'

export interface DayRange { min: number; max: number }

export interface ModeConfig {
  // Booking, customs and loading — the time BEFORE the vessel/train/truck
  // leaves. The supplier quotes say "X days after departure", so without this
  // as its own phase the wait would silently vanish from the plan.
  preDeparture: DayRange
  transit:      DayRange
  costUsd:      number
}

export interface CalcConfig {
  // Ordered ascending. A quantity picks the first tier that still covers it;
  // above the largest tier the largest tier's value is used. Deliberately NOT
  // interpolated — two data points do not support that precision.
  productionTiers: { qty: number; days: number }[]
  weshipHandling:  DayRange
  modes:           Record<ShipMode, ModeConfig>
  usdEur:          number
}

// Defaults taken from past supplier quotes (Amanda / Max). Pre-departure is an
// estimate — the quotes do not state it — and is meant to be corrected once
// planned-vs-actual data accumulates in the inbounds table.
export const DEFAULT_CALC_CONFIG: CalcConfig = {
  productionTiers: [
    { qty: 1000, days: 45 },
    { qty: 5000, days: 60 },
  ],
  weshipHandling: { min: 1, max: 2 },
  modes: {
    air:   { preDeparture: { min:  7, max: 12 }, transit: { min: 11, max: 11 }, costUsd: 11533 },
    truck: { preDeparture: { min:  5, max: 10 }, transit: { min: 25, max: 30 }, costUsd:  5315 },
    train: { preDeparture: { min:  5, max: 10 }, transit: { min: 35, max: 40 }, costUsd:  4466 },
    sea:   { preDeparture: { min:  7, max: 14 }, transit: { min: 45, max: 60 }, costUsd:  3761 },
  },
  usdEur: 0.92,
}

// ─── Date helpers (UTC, calendar days) ───────────────────────────────────────
// Calendar days throughout: the transit quotes are calendar days, and the one
// break that really matters — Chinese New Year — is not derivable from them.

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number)
  const [y2, m2, d2] = toIso.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// en-GB to match how dates already read everywhere else in the app
// (components/ui/calendar-styles.ts, lib/date-range.ts).
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// ─── Production ──────────────────────────────────────────────────────────────

export function productionDaysFor(quantity: number, tiers: CalcConfig['productionTiers']): number {
  if (tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty)
  return (sorted.find(t => quantity <= t.qty) ?? sorted[sorted.length - 1]).days
}

// ─── Costs ───────────────────────────────────────────────────────────────────

// Only the 'manufacturing' items count here. The 'ib_shipping' items in
// costs-config are themselves a per-unit freight estimate and would double-count
// against the freight figure the calculator carries per mode.
//
// Keyed by inbound product, resolved through its costKey — the two bag colours
// are separate products to order but share one cost entry, so looking up by the
// product id directly would find nothing and silently bill them at zero.
export function productionCostByProduct(
  costs: ProductCostConfig[],
  qtyByProduct: Record<string, number>,
): Record<string, number> {
  const perUnitByCostKey = new Map<string, number>()
  for (const p of costs) {
    perUnitByCostKey.set(
      p.id,
      p.items.filter(it => it.costType === 'manufacturing').reduce((s, it) => s + it.amount, 0),
    )
  }

  const out: Record<string, number> = {}
  for (const p of INBOUND_PRODUCTS) {
    const qty = qtyByProduct[p.id] ?? 0
    if (!qty) continue
    out[p.id] = (perUnitByCostKey.get(p.costKey) ?? 0) * qty
  }
  return out
}

export function productionCostEur(
  costs: ProductCostConfig[],
  qtyByProduct: Record<string, number>,
): number {
  return Object.values(productionCostByProduct(costs, qtyByProduct)).reduce((s, v) => s + v, 0)
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface PhaseSpan {
  key:      'production' | 'preDeparture' | 'transit' | 'weship'
  label:    string
  days:     DayRange
  startMin: number   // day offsets from the order date
  endMin:   number
  startMax: number
  endMax:   number
}

export interface ModeResult {
  mode:            ShipMode
  label:           string
  phases:          PhaseSpan[]
  productionEnd:   string
  departure:       { min: string; max: string }
  arrival:         { min: string; max: string }
  readyAtWeship:   { min: string; max: string }
  totalDays:       DayRange
  spanDays:        number          // width of the uncertainty band
  costUsd:         number
  costEur:         number
  productionEur:   number
  totalEur:        number
  shippingPerUnit: number | null
  landedPerUnit:   number | null
}

export interface CalcInput {
  orderDate:      string
  qtyByProduct:   Record<string, number>
  productionDays: number
  config:         CalcConfig
  costs:          ProductCostConfig[]
}

export function calculateMode(mode: ShipMode, input: CalcInput): ModeResult {
  const { orderDate, qtyByProduct, productionDays, config, costs } = input
  const m = config.modes[mode]

  const phases: PhaseSpan[] = []
  let cumMin = 0
  let cumMax = 0

  function push(key: PhaseSpan['key'], label: string, days: DayRange) {
    phases.push({
      key, label, days,
      startMin: cumMin, endMin: cumMin + days.min,
      startMax: cumMax, endMax: cumMax + days.max,
    })
    cumMin += days.min
    cumMax += days.max
  }

  push('production',   'Production',    { min: productionDays, max: productionDays })
  const productionEnd = addDays(orderDate, cumMin)

  push('preDeparture', 'Pre-departure', m.preDeparture)
  const departure = { min: addDays(orderDate, cumMin), max: addDays(orderDate, cumMax) }

  push('transit',      'Transit',       m.transit)
  const arrival = { min: addDays(orderDate, cumMin), max: addDays(orderDate, cumMax) }

  push('weship',       'WeShip handling', config.weshipHandling)
  const readyAtWeship = { min: addDays(orderDate, cumMin), max: addDays(orderDate, cumMax) }

  const totalQty      = Object.values(qtyByProduct).reduce((s, q) => s + (q || 0), 0)
  const costEur       = m.costUsd * config.usdEur
  const productionEur = productionCostEur(costs, qtyByProduct)

  return {
    mode,
    label: SHIP_MODES.find(s => s.id === mode)?.label ?? mode,
    phases,
    productionEnd,
    departure,
    arrival,
    readyAtWeship,
    totalDays: { min: cumMin, max: cumMax },
    spanDays: cumMax - cumMin,
    costUsd: m.costUsd,
    costEur,
    productionEur,
    totalEur: productionEur + costEur,
    shippingPerUnit: totalQty ? costEur / totalQty : null,
    landedPerUnit:   totalQty ? (productionEur + costEur) / totalQty : null,
  }
}

export function calculateAll(input: CalcInput): ModeResult[] {
  return SHIP_MODES.map(m => calculateMode(m.id, input))
}
