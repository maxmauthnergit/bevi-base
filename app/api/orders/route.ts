import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyOrder } from '@/lib/shopify/client'
import type { OrderRow } from '@/lib/types'
export type { OrderRow }

// ─── Per-product cost profiles ────────────────────────────────────────────────
// production = material + shipping ins Lager (Quanzhou Pengxin + Shenzen Amanda etc.)
// weship     = WeShip variable: Auftragsabwicklung + Kommissionierung +
//              Verpackung & Versand + Paketbeilager + Verpackungsmaterial + Warenannahme
// shipping   = Post/DHL delivery to end customer
// payment    = computed per order: 2% × gross + 0.25 €

interface CostProfile { production: number; weship: number; shipping: number }

// Ordered longest-match first so "bundle l" doesn't match "bundle"
const COST_MAP: [string, CostProfile][] = [
  ['squad',         { production: 38.70, weship: 4.20, shipping: 5.40 }],
  ['bundle l',      { production: 16.55, weship: 3.89, shipping: 5.40 }],
  ['bundle m',      { production: 14.65, weship: 3.50, shipping: 5.40 }],
  ['bundle s',      { production: 13.34, weship: 3.50, shipping: 5.40 }],
  ['full set',      { production: 12.90, weship: 3.04, shipping: 5.40 }],
  ['water bladder', { production:  2.93, weship: 3.05, shipping: 2.50 }],
  ['cleaning kit',  { production:  3.21, weship: 3.05, shipping: 5.40 }],
  ['phone strap',   { production:  0.44, weship: 3.04, shipping: 2.50 }],
]

function getCosts(title: string): CostProfile {
  const t = title.toLowerCase()
  for (const [key, profile] of COST_MAP) {
    if (t.includes(key)) return profile
  }
  return { production: 0, weship: 0, shipping: 0 }
}

// ─── Route handler ────────────────────────────────────────────────────────────
const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'total_price', 'total_tax',
  'financial_status', 'fulfillment_status', 'cancel_reason', 'cancelled_at',
  'line_items', 'shipping_address', 'billing_address',
].join(',')

export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get('month') // YYYY-MM

  let from: Date, to: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    from = new Date(y, m - 1, 1)
    to   = new Date(y, m, 0, 23, 59, 59)
  } else {
    const now = new Date()
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  }

  let rawOrders: ShopifyOrder[]
  try {
    const params = new URLSearchParams({
      status:         'any',
      created_at_min: from.toISOString(),
      created_at_max: to.toISOString(),
      limit:          '250',
      fields:         ORDER_FIELDS,
    })
    const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
      `/orders.json?${params}`,
      { next: { revalidate: 300 } }
    )
    rawOrders = data.orders
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const rows: OrderRow[] = rawOrders
    .filter(o => !o.cancelled_at && o.financial_status !== 'voided')
    .map(o => {
      const gross = parseFloat(o.total_price) || 0
      const tax   = parseFloat(o.total_tax)   || 0
      const net   = gross - tax

      let cost_production = 0
      let cost_weship     = 0
      let cost_shipping   = 0

      for (const li of o.line_items) {
        const p = getCosts(li.title)
        cost_production += p.production * li.quantity
        cost_weship     += p.weship     * li.quantity
        cost_shipping   += p.shipping   * li.quantity
      }

      const cost_payment = Math.round((0.02 * gross + 0.25) * 100) / 100
      const cost_total   = Math.round(
        (cost_production + cost_weship + cost_shipping + cost_payment) * 100
      ) / 100
      const margin = net > 0
        ? Math.round(((net - cost_total) / net) * 1000) / 10
        : 0

      return {
        id:                 o.id,
        name:               o.name,
        created_at:         o.created_at,
        financial_status:   o.financial_status,
        fulfillment_status: o.fulfillment_status,
        country_code:       o.shipping_address?.country_code ?? o.billing_address?.country_code ?? null,
        revenue_tax:        Math.round(tax * 100) / 100,
        items: o.line_items.map(li => {
          const p = getCosts(li.title)
          return {
            title:           li.title,
            qty:             li.quantity,
            unit_price:      Math.round((parseFloat(li.price) || 0) * 100) / 100,
            cost_production: p.production,
            cost_weship:     p.weship,
            cost_shipping:   p.shipping,
          }
        }),
        revenue_gross:   Math.round(gross           * 100) / 100,
        revenue_net:     Math.round(net             * 100) / 100,
        cost_production: Math.round(cost_production * 100) / 100,
        cost_weship:     Math.round(cost_weship     * 100) / 100,
        cost_shipping:   Math.round(cost_shipping   * 100) / 100,
        cost_payment,
        cost_total,
        margin,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ orders: rows })
}
