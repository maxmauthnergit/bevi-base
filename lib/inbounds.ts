// ─── Inbounds ────────────────────────────────────────────────────────────────
// Goods purchases ("Charges") ordered in China and tracked until they arrive at
// the WeShip warehouse. Schema: supabase/inbounds.sql
//
// A charge splits into shipments: part of an order often travels by air and the
// rest by train, so the mode, the freight cost and the arrival dates belong to a
// shipment — not to the charge and not to the product.

export type ShipMode = 'air' | 'truck' | 'train' | 'sea'

// Labels are what the forwarders quote; the ids stay as they are because they
// are already stored in inbound_shipments.mode and keyed into the calculator
// config in app_config — renaming them would need a data migration for nothing.
export const SHIP_MODES: { id: ShipMode; label: string }[] = [
  { id: 'air',   label: 'Air'  },
  { id: 'truck', label: 'Road' },
  { id: 'train', label: 'Rail' },
  { id: 'sea',   label: 'Sea'  },
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

/**
 * A production position: what was made, how much of it, and what it cost EXW.
 * Suppliers invoice in USD; the EUR figure is the converted one and is stored
 * so it stays fixed once the charge is done.
 */
export interface InboundItem {
  product_id:          string
  charge:              string      // free text, optional; may repeat
  quantity:            number
  production_cost_usd: number      // total for the position, not per unit
  production_cost_eur: number      // usd × the charge's production rate
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
  cost_usd:             number
  cost_eur:             number      // usd × this shipment's rate
  fx_usd_eur:           number | null
  fx_date:              string | null
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
  name:       string            // label for the delivery; not unique
  order_date: string            // YYYY-MM-DD
  notes:      string
  // One rate for the whole production section — it is paid in one go at
  // ordering. Freight is paid later and carries its own rate per shipment.
  production_fx_usd_eur: number | null
  production_fx_date:    string | null
  created_at?: string
  items:      InboundItem[]
  shipments:  InboundShipment[]
  invoices:   InboundInvoice[]
}

// ─── Currency ────────────────────────────────────────────────────────────────

/**
 * Converts an invoiced USD amount at a given rate, rounded to cents. A missing
 * or zero rate yields null rather than 0, so the UI can show "rate missing"
 * instead of silently claiming the position is free.
 */
export function usdToEur(usd: number, rate: number | null): number | null {
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null
  if (!Number.isFinite(usd)) return null
  return Math.round(usd * rate * 100) / 100
}

export const INVOICE_BUCKET = 'inbound-invoices'

// ─── Products ────────────────────────────────────────────────────────────────

export interface InboundProduct {
  id:      string   // stored in inbound_items.product_id
  name:    string
  /**
   * Which entry in lib/costs-config.ts supplies the production cost. Both bag
   * colours point at the same one: they are ordered and produced separately but
   * cost the same, and the cost config cannot be split — it keys its amounts by
   * `titleKey`, so a second 'full set' entry would silently overwrite the first
   * and the order statistics would bill against the wrong rate.
   */
  costKey: string
  /**
   * Shopify/WeShip SKU, where the product has one. It is the only link between
   * an inbound product and its stock level — the two id spaces are otherwise
   * unrelated — and so it also decides what the calculator can plan: forecasting
   * a delivery without a stock figure to land it in would be guesswork.
   */
  forecastSku?: string
}

/**
 * What an inbound can be booked against. Deliberately its own list rather than
 * derived from DEFAULT_PRODUCT_COSTS: the bag is one product for costing and
 * for Shopify title matching, but two for ordering.
 */
export const INBOUND_PRODUCTS: InboundProduct[] = [
  { id: 'bevi-bag-black', name: 'Bevi Bag Full Set (Black)',    costKey: 'bevi-bag',     forecastSku: '9180013220099' },
  { id: 'bevi-bag-beige', name: 'Bevi Bag Full Set (Beige)',    costKey: 'bevi-bag',     forecastSku: '9180013220129' },
  { id: 'water-bladder',  name: 'Bevi Water Bladder + Tubes',   costKey: 'water-bladder' },
  { id: 'phone-strap',    name: 'Bevi Phone Strap',             costKey: 'phone-strap'   },
  { id: 'cleaning-kit',   name: 'Bevi Cleaning Kit',            costKey: 'cleaning-kit'  },
]

/**
 * Ids that are no longer offered but may still sit in older rows. Keeps them
 * readable instead of showing a raw key.
 */
const LEGACY_PRODUCT_NAMES: Record<string, string> = {
  'bevi-bag': 'Bevi Bag Full Set',
}

export function productName(productId: string) {
  return INBOUND_PRODUCTS.find(p => p.id === productId)?.name
    ?? LEGACY_PRODUCT_NAMES[productId]
    ?? productId
}

/**
 * What the inbound calculator can plan: the products whose stock it can actually
 * project. Today that is the two bag colours — the main product, and the only
 * one with a SKU on file. Giving another product a forecastSku adds it here.
 */
export const CALCULATOR_PRODUCTS = INBOUND_PRODUCTS.filter(p => p.forecastSku)

/** Inbound product id for a stock SKU, for joining stock rows to a product. */
export function productIdForSku(sku: string): string | null {
  return INBOUND_PRODUCTS.find(p => p.forecastSku === sku)?.id ?? null
}

/** Guards against a rename in costs-config quietly zeroing a production cost. */
export function unresolvedCostKeys(costIds: string[]): string[] {
  const known = new Set(costIds)
  return [...new Set(INBOUND_PRODUCTS.map(p => p.costKey))].filter(k => !known.has(k))
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

// ─── Per-product cost summary ────────────────────────────────────────────────

export interface ProductCost {
  product_id:        string
  quantity:          number
  productionEur:     number
  shippingEur:       number
  productionPerUnit: number | null
  shippingPerUnit:   number | null
  landedPerUnit:     number | null
}

export interface CostSummary {
  products:    ProductCost[]
  /**
   * Freight that could not be attributed to a product: a shipment with no
   * quantities allocated yet, or an allocation that does not cover everything.
   * Reported rather than swallowed, so the rows always add up to the DDP total.
   */
  unallocated: number
  total:       number
}

/**
 * Splits each shipment's freight across the products it carries, by quantity —
 * the same basis as the "distribute by quantity" action, and the only one the
 * data supports (there is no weight or volume anywhere).
 *
 * Per-unit figures use the PRODUCED quantity as the denominator, so production
 * and shipping per unit share a base and add up to the landed cost.
 */
export function perProductSummary(inbound: Pick<Inbound, 'items' | 'shipments'>): CostSummary {
  const share: Record<string, number> = {}
  let unallocated = 0

  for (const sh of inbound.shipments) {
    const qtyOnShipment = sh.items.reduce((s, li) => s + li.quantity, 0)
    if (qtyOnShipment <= 0) {
      // Nothing allocated on this leg — its freight belongs to no product yet.
      unallocated += sh.cost_eur
      continue
    }
    for (const li of sh.items) {
      share[li.product_id] = (share[li.product_id] ?? 0) + sh.cost_eur * li.quantity / qtyOnShipment
    }
  }

  const products: ProductCost[] = inbound.items.map(it => {
    const shippingEur = share[it.product_id] ?? 0
    const per = (v: number) => (it.quantity > 0 ? v / it.quantity : null)
    const productionPerUnit = per(it.production_cost_eur)
    const shippingPerUnit   = per(shippingEur)
    return {
      product_id:    it.product_id,
      quantity:      it.quantity,
      productionEur: it.production_cost_eur,
      shippingEur,
      productionPerUnit,
      shippingPerUnit,
      landedPerUnit: productionPerUnit === null || shippingPerUnit === null
        ? null
        : productionPerUnit + shippingPerUnit,
    }
  })

  // Freight attributed to a product that carries no production position of its
  // own would otherwise vanish from the table.
  const known = new Set(inbound.items.map(it => it.product_id))
  for (const [productId, value] of Object.entries(share)) {
    if (!known.has(productId)) unallocated += value
  }

  const t = inboundTotals(inbound)
  return { products, unallocated, total: t.total }
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
