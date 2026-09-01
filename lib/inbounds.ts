// ─── Inbounds ────────────────────────────────────────────────────────────────
// Goods purchases ("Charges") ordered in China and tracked until they arrive at
// the WeShip warehouse. Schema: supabase/inbounds_v2.sql
//
// A charge splits into shipments: part of an order often travels by air and the
// rest by train, so the mode, the freight cost and the arrival dates belong to a
// shipment — not to the charge and not to the product.

import { DEFAULT_PRODUCT_COSTS } from '@/lib/costs-config'

export type ShipMode = 'air' | 'truck' | 'train' | 'sea'

export const SHIP_MODES: { id: ShipMode; label: string }[] = [
  { id: 'air',   label: 'Air'   },
  { id: 'truck', label: 'Truck' },
  { id: 'train', label: 'Train' },
  { id: 'sea',   label: 'Sea'   },
]

export function shipModeLabel(mode: string | null): string {
  return SHIP_MODES.find(m => m.id === mode)?.label ?? '—'
}

export interface Partner {
  id:          string
  name:        string
  is_supplier: boolean
  is_shipping: boolean
}

/** A production position: what was made, how much of it, and what it cost EXW. */
export interface InboundItem {
  product_id:          string
  quantity:            number
  production_cost_eur: number      // total for the position, not per unit
  supplier_id:         string | null
}

/** How much of one product travels on a given shipment. */
export interface ShipmentItem {
  product_id: string
  quantity:   number
}

export interface InboundShipment {
  id?:                  string
  mode:                 ShipMode
  shipping_company_id:  string | null
  cost_eur:             number
  planned_arrival:      string | null
  actual_arrival:       string | null
  items:                ShipmentItem[]
}

export interface InboundInvoice {
  id:           string
  shipment_id:  string | null   // null = belongs to production
  filename:     string
  content_type: string | null
  size_bytes:   number | null
  uploaded_at:  string
}

export interface Inbound {
  id:         string
  charge:     string
  order_date: string            // YYYY-MM-DD
  notes:      string
  created_at?: string
  items:      InboundItem[]
  shipments:  InboundShipment[]
  invoices:   InboundInvoice[]
}

export const INVOICE_BUCKET = 'inbound-invoices'

// The product list every inbound picks from — the same four products the
// settings page and the order statistics already use.
export const INBOUND_PRODUCTS = DEFAULT_PRODUCT_COSTS.map(p => ({ id: p.id, name: p.name }))

export function productName(productId: string) {
  return INBOUND_PRODUCTS.find(p => p.id === productId)?.name ?? productId
}

// ─── Totals ──────────────────────────────────────────────────────────────────

export interface InboundTotals {
  quantity:   number
  production: number
  shipping:   number
  total:      number   // production & IB shipping, DDP
}

export function inboundTotals(inbound: Pick<Inbound, 'items' | 'shipments'>): InboundTotals {
  const production = inbound.items.reduce((s, it) => s + it.production_cost_eur, 0)
  const shipping   = inbound.shipments.reduce((s, sh) => s + sh.cost_eur, 0)
  return {
    quantity: inbound.items.reduce((s, it) => s + it.quantity, 0),
    production,
    shipping,
    total: production + shipping,
  }
}

/** Per-unit landed cost across the whole charge; null while nothing is ordered. */
export function landedPerUnit(inbound: Pick<Inbound, 'items' | 'shipments'>): number | null {
  const t = inboundTotals(inbound)
  return t.quantity ? t.total / t.quantity : null
}

// ─── Arrival span ────────────────────────────────────────────────────────────

export interface DateSpan { min: string; max: string }

/**
 * Earliest and latest arrival across a charge's shipments, since two legs of the
 * same charge land weeks apart. `kind: 'actual'` reports what has landed,
 * `'planned'` what is scheduled. Returns null when no shipment carries that date.
 */
export function arrivalSpan(
  shipments: Pick<InboundShipment, 'planned_arrival' | 'actual_arrival'>[],
  kind: 'planned' | 'actual',
): DateSpan | null {
  const dates = shipments
    .map(s => (kind === 'actual' ? s.actual_arrival : s.planned_arrival))
    .filter((d): d is string => !!d)
    .sort()

  if (dates.length === 0) return null
  return { min: dates[0], max: dates[dates.length - 1] }
}

/** True once every shipment has an actual arrival date. */
export function fullyArrived(shipments: Pick<InboundShipment, 'actual_arrival'>[]): boolean {
  return shipments.length > 0 && shipments.every(s => !!s.actual_arrival)
}

// ─── Quantity reconciliation ─────────────────────────────────────────────────

export interface QuantityCheck {
  product_id: string
  ordered:    number   // from the production positions
  shipped:    number   // summed across all shipments
  diff:       number   // shipped - ordered; 0 means it adds up
}

/**
 * Compares what was produced against what the shipments carry. Surfaced as a
 * hint rather than a hard rule — a charge gets filled in over weeks, so it has
 * to be saveable while the numbers still disagree.
 */
export function reconcileQuantities(
  items: Pick<InboundItem, 'product_id' | 'quantity'>[],
  shipments: Pick<InboundShipment, 'items'>[],
): QuantityCheck[] {
  return items.map(it => {
    const shipped = shipments.reduce(
      (s, sh) => s + (sh.items.find(si => si.product_id === it.product_id)?.quantity ?? 0),
      0,
    )
    return {
      product_id: it.product_id,
      ordered: it.quantity,
      shipped,
      diff: shipped - it.quantity,
    }
  })
}
