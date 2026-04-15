import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyOrder } from '@/lib/shopify/client'
import type { OrderRow } from '@/lib/types'
import { getWeShipMonthData } from '@/lib/weship/xlsx-parser'
export type { OrderRow }

// ─── Per-product cost profiles (fallback estimates) ───────────────────────────
// manufacturing = Quanzhou Pengxin / direct manufacturer
// ib_shipping   = Shenzhen Amanda / IB freight to warehouse Graz
// weship        = WeShip variable: Auftragsabwicklung + Kommissionierung +
//                 Verpackung & Versand + Paketbeilager + Verpackungsmaterial + Warenannahme
// shipping      = Post/DHL delivery to end customer (OB)
// payment       = computed per order: 2% × gross + 0.25 €

interface CostProfile {
  manufacturing: number   // Quanzhou Pengxin
  ib_shipping:   number   // Shenzhen Amanda
  weship:        number
  shipping:      number
}

const COST_MAP: [string, CostProfile][] = [
  ['squad',         { manufacturing: 27.03, ib_shipping: 11.67, weship: 4.20, shipping: 5.40 }],
  ['bundle l',      { manufacturing: 11.20, ib_shipping:  5.35, weship: 3.89, shipping: 5.40 }],
  ['bundle m',      { manufacturing: 10.76, ib_shipping:  3.89, weship: 3.50, shipping: 5.40 }],
  ['bundle s',      { manufacturing:  9.45, ib_shipping:  3.89, weship: 3.50, shipping: 5.40 }],
  ['full set',      { manufacturing:  9.01, ib_shipping:  3.89, weship: 3.04, shipping: 5.40 }],
  ['water bladder', { manufacturing:  2.53, ib_shipping:  0.40, weship: 3.05, shipping: 2.50 }],
  ['cleaning kit',  { manufacturing:  1.75, ib_shipping:  1.46, weship: 3.05, shipping: 5.40 }],
  ['phone strap',   { manufacturing:  0.33, ib_shipping:  0.11, weship: 3.04, shipping: 2.50 }],
]

function getCosts(title: string): CostProfile {
  const t = title.toLowerCase()
  for (const [key, profile] of COST_MAP) {
    if (t.includes(key)) return profile
  }
  return { manufacturing: 0, ib_shipping: 0, weship: 0, shipping: 0 }
}

// ─── Route handler ────────────────────────────────────────────────────────────

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'total_price', 'total_tax', 'total_discounts',
  'financial_status', 'fulfillment_status', 'cancel_reason', 'cancelled_at',
  'line_items', 'shipping_address', 'billing_address',
].join(',')

function offsetMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get('month') // YYYY-MM

  let from: Date, to: Date, month: string
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    from  = new Date(y, m - 1, 1)
    to    = new Date(y, m, 0, 23, 59, 59)
    month = monthParam
  } else {
    const now = new Date()
    from  = new Date(now.getFullYear(), now.getMonth(), 1)
    to    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // Load Shopify orders + current, previous, and next month XLSX in parallel.
  const [shopifyResult, xlsxCurr, xlsxPrev, xlsxNext] = await Promise.all([
    shopifyFetch<{ orders: ShopifyOrder[] }>(
      `/orders.json?${new URLSearchParams({
        status:         'any',
        created_at_min: from.toISOString(),
        created_at_max: to.toISOString(),
        limit:          '250',
        fields:         ORDER_FIELDS,
      })}`,
      { next: { revalidate: 300 } }
    ).catch((err: unknown) => ({ error: String(err) })),
    getWeShipMonthData(month),
    getWeShipMonthData(offsetMonth(month, -1)),
    getWeShipMonthData(offsetMonth(month, +1)),
  ])

  if ('error' in shopifyResult) {
    return NextResponse.json({ error: shopifyResult.error }, { status: 500 })
  }

  // Merge maps: current month takes priority over adjacent months
  const anyParsed = xlsxCurr.parsed || xlsxPrev.parsed || xlsxNext.parsed
  const mergedByOrder = new Map([
    ...xlsxNext.byOrder,
    ...xlsxPrev.byOrder,
    ...xlsxCurr.byOrder,
  ])

  const rawOrders = shopifyResult.orders

  const rows: OrderRow[] = rawOrders
    .filter(o => !o.cancelled_at && o.financial_status !== 'voided')
    .map(o => {
      const gross    = parseFloat(o.total_price)     || 0
      const tax      = parseFloat(o.total_tax)       || 0
      const net      = gross - tax
      const discount = parseFloat(o.total_discounts) || 0

      // Estimated costs from COGS config (always computed as fallback)
      let est_manufacturing = 0
      let est_ib_shipping   = 0
      let est_weship        = 0
      let est_shipping      = 0

      for (const li of o.line_items) {
        const p = getCosts(li.title)
        est_manufacturing += p.manufacturing * li.quantity
        est_ib_shipping   += p.ib_shipping   * li.quantity
        est_weship        += p.weship        * li.quantity
        est_shipping      += p.shipping      * li.quantity
      }

      const est_production = est_manufacturing + est_ib_shipping

      // Actual costs from XLSX (when available, any adjacent month)
      const xlsxEntry     = mergedByOrder.get(o.name)
      const hasXlsx       = anyParsed && xlsxEntry !== undefined
      const cost_weship   = hasXlsx ? Math.round(xlsxEntry!.weship   * 100) / 100 : Math.round(est_weship   * 100) / 100
      const cost_shipping = hasXlsx ? Math.round(xlsxEntry!.shipping * 100) / 100 : Math.round(est_shipping * 100) / 100

      const cost_production = Math.round(est_production * 100) / 100
      const cost_payment    = Math.round((0.02 * gross + 0.25) * 100) / 100
      const cost_total      = Math.round((cost_production + cost_weship + cost_shipping + cost_payment) * 100) / 100
      const margin          = net > 0 ? Math.round(((net - cost_total) / net) * 1000) / 10 : 0

      return {
        id:                 o.id,
        name:               o.name,
        created_at:         o.created_at,
        financial_status:   o.financial_status,
        fulfillment_status: o.fulfillment_status,
        country_code:       o.shipping_address?.country_code ?? o.billing_address?.country_code ?? null,
        revenue_gross:      Math.round(gross    * 100) / 100,
        revenue_tax:        Math.round(tax      * 100) / 100,
        revenue_net:        Math.round(net      * 100) / 100,
        discount:           Math.round(discount * 100) / 100,
        items: o.line_items.map(li => {
          const p = getCosts(li.title)
          return {
            title:              li.title,
            qty:                li.quantity,
            unit_price:         Math.round((parseFloat(li.price) || 0) * 100) / 100,
            cost_manufacturing: p.manufacturing,
            cost_ib_shipping:   p.ib_shipping,
            cost_production:    Math.round((p.manufacturing + p.ib_shipping) * 100) / 100,
            cost_weship:        p.weship,
            cost_shipping:      p.shipping,
          }
        }),
        cost_production,
        cost_weship,
        cost_shipping,
        cost_payment,
        cost_total,
        margin,
        weship_source:   (hasXlsx ? 'actual'    : 'estimated') as 'actual' | 'estimated',
        shipping_source: (hasXlsx ? 'actual'    : 'estimated') as 'actual' | 'estimated',
        weship_items:   hasXlsx ? xlsxEntry!.weshipItems   : undefined,
        shipping_items: hasXlsx ? xlsxEntry!.shippingItems : undefined,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({
    orders: rows,
    xlsx: {
      parsed:  anyParsed,
      matched: rows.filter(r => r.weship_source === 'actual').length,
      debug:   xlsxCurr.debug,
    },
  })
}
