// ─── Inbounds ────────────────────────────────────────────────────────────────
// Goods purchases ("Charges") ordered in China and tracked until they arrive
// at the WeShip warehouse. Schema: supabase/inbounds.sql

import { DEFAULT_PRODUCT_COSTS } from '@/lib/costs-config'

export type ShipMode = 'air' | 'truck' | 'train' | 'sea'

export const SHIP_MODES: { id: ShipMode; label: string }[] = [
  { id: 'air',   label: 'Air'   },
  { id: 'truck', label: 'Truck' },
  { id: 'train', label: 'Train' },
  { id: 'sea',   label: 'Sea'   },
]

export interface InboundItem {
  product_id:          string
  quantity:            number
  production_cost_eur: number
  shipping_cost_eur:   number
}

export interface Inbound {
  id:                       string
  charge_no:                string
  order_date:               string          // YYYY-MM-DD
  shipping_mode:            ShipMode | null
  weship_arrival_date:      string | null
  planned_weship_date_min:  string | null
  planned_weship_date_max:  string | null
  production_invoice_path:  string | null
  shipping_invoice_path:    string | null
  notes:                    string
  created_at?:              string
  items:                    InboundItem[]
}

export type InvoiceKind = 'production' | 'shipping'

export const INVOICE_BUCKET = 'inbound-invoices'

// The product list every inbound picks from — same four products the settings
// page and the order statistics already use.
export const INBOUND_PRODUCTS = DEFAULT_PRODUCT_COSTS.map(p => ({ id: p.id, name: p.name }))

export function productName(productId: string) {
  return INBOUND_PRODUCTS.find(p => p.id === productId)?.name ?? productId
}

export interface InboundTotals {
  quantity:   number
  production: number
  shipping:   number
  total:      number
}

export function inboundTotals(items: InboundItem[]): InboundTotals {
  const production = items.reduce((s, it) => s + it.production_cost_eur, 0)
  const shipping   = items.reduce((s, it) => s + it.shipping_cost_eur, 0)
  return {
    quantity: items.reduce((s, it) => s + it.quantity, 0),
    production,
    shipping,
    total: production + shipping,
  }
}

// Per-unit landed cost of a position. Returns null for a zero quantity rather
// than dividing by zero — callers render a dash.
export function unitCost(item: InboundItem): number | null {
  if (!item.quantity) return null
  return (item.production_cost_eur + item.shipping_cost_eur) / item.quantity
}

// You get ONE freight invoice per charge, not one per product. This spreads a
// single total across the positions by quantity; the last position absorbs the
// rounding remainder so the parts always add back up to the total.
export function allocateByQuantity(items: InboundItem[], totalEur: number): number[] {
  const totalQty = items.reduce((s, it) => s + it.quantity, 0)
  if (!totalQty) return items.map(() => 0)

  const out: number[] = []
  let assigned = 0
  items.forEach((it, i) => {
    if (i === items.length - 1) {
      out.push(Math.round((totalEur - assigned) * 100) / 100)
      return
    }
    const share = Math.round((totalEur * it.quantity / totalQty) * 100) / 100
    assigned += share
    out.push(share)
  })
  return out
}
