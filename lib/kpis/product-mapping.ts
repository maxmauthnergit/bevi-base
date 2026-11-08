// ─── Shopify line item → inbound products ────────────────────────────────────
// Inbounds are booked per inbound product id (lib/inbounds.ts), Shopify sells
// by title / SKU. This is the one place that joins the two, so FIFO knows which
// lots a sold unit draws from.

import { INBOUND_PRODUCTS } from '@/lib/inbounds'

export interface UnitDemand {
  productId: string
  quantity:  number
}

interface LineItemLike {
  title:          string
  variant_title?: string | null
  sku?:           string | null
  quantity:       number
}

const BAG = '@bag'   // placeholder resolved to the black or beige bag

// Bundles sold as their own Shopify product. Native Shopify bundles list their
// components as separate line items and need no entry here.
// Compositions follow the per-unit rates in lib/order-costs.ts COST_MAP, which
// add up exactly to these parts (e.g. squad 27.03 = 3 × 9.01).
const BUNDLES: [string, [string, number][]][] = [
  ['squad',    [[BAG, 3]]],
  ['bundle l', [[BAG, 1], ['cleaning-kit', 1], ['phone-strap', 1]]],
  ['bundle m', [[BAG, 1], ['cleaning-kit', 1]]],
  ['bundle s', [[BAG, 1], ['phone-strap', 1]]],
]

const SINGLES: [string, string][] = [
  ['full set',      BAG],
  ['water bladder', 'water-bladder'],
  ['phone strap',   'phone-strap'],
  ['cleaning kit',  'cleaning-kit'],
]

function bagFor(li: LineItemLike): string {
  const bySku = INBOUND_PRODUCTS.find(p => p.forecastSku && p.forecastSku === li.sku)
  if (bySku) return bySku.id
  const text = `${li.title} ${li.variant_title ?? ''}`.toLowerCase()
  return text.includes('beige') ? 'bevi-bag-beige' : 'bevi-bag-black'
}

/**
 * Units of each inbound product one line item consumes, or null when the item
 * is not a product we stock (gift card, shipping protection, …).
 */
export function mapLineItem(li: LineItemLike): UnitDemand[] | null {
  if (li.quantity <= 0) return []

  const bySku = INBOUND_PRODUCTS.find(p => p.forecastSku && p.forecastSku === li.sku)
  if (bySku) return [{ productId: bySku.id, quantity: li.quantity }]

  const t = li.title.toLowerCase()
  const resolve = (id: string) => (id === BAG ? bagFor(li) : id)

  // Bundles first: a bundle title may also name its parts ("Bundle S – Full Set + Strap")
  for (const [key, parts] of BUNDLES) {
    if (t.includes(key)) return parts.map(([id, n]) => ({ productId: resolve(id), quantity: n * li.quantity }))
  }
  for (const [key, id] of SINGLES) {
    if (t.includes(key)) return [{ productId: resolve(id), quantity: li.quantity }]
  }
  return null
}
