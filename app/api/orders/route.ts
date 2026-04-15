import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyOrder } from '@/lib/shopify/client'
import type { OrderRow } from '@/lib/types'
import { getWeShipMonthData } from '@/lib/weship/xlsx-parser'
export type { OrderRow }

// ─── Per-product cost profiles (last-resort COGS fallback) ────────────────────
// Used only when no actual XLSX data AND no historical reference exists.

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

// Canonical product key for composition matching
function getProductKey(title: string): string {
  const t = title.toLowerCase()
  for (const [key] of COST_MAP) {
    if (t.includes(key)) return key
  }
  return t.replace(/\s+/g, '-').slice(0, 40)
}

// Stable key representing a basket's product composition (order-insensitive)
function compositionKey(lineItems: ShopifyOrder['line_items']): string {
  return lineItems
    .map(li => `${getProductKey(li.title)}:${li.quantity}`)
    .sort()
    .join('|')
}

// ─── Route helpers ────────────────────────────────────────────────────────────

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

function fetchMonthOrders(m: string): Promise<{ orders: ShopifyOrder[] }> {
  const [y, mo] = m.split('-').map(Number)
  const from = new Date(y, mo - 1, 1)
  const to   = new Date(y, mo, 0, 23, 59, 59)
  return shopifyFetch<{ orders: ShopifyOrder[] }>(
    `/orders.json?${new URLSearchParams({
      status:         'any',
      created_at_min: from.toISOString(),
      created_at_max: to.toISOString(),
      limit:          '250',
      fields:         ORDER_FIELDS,
    })}`,
    { next: { revalidate: 300 } }
  ).catch((): { orders: ShopifyOrder[] } => ({ orders: [] }))
}

// ─── Route handler ────────────────────────────────────────────────────────────

const LOOKBACK = 3   // months of history used to build reference averages

export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get('month')

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

  const lookbackKeys = Array.from({ length: LOOKBACK }, (_, i) => offsetMonth(month, -(i + 1)))

  // All fetches in parallel: current month + adjacent XLSX + lookback Shopify + lookback XLSX
  const [
    [shopifyResult, xlsxCurr, xlsxPrev, xlsxNext],
    lookbackShopify,
    lookbackXlsx,
  ] = await Promise.all([
    Promise.all([
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
    ] as const),
    Promise.all(lookbackKeys.map(fetchMonthOrders)),
    Promise.all(lookbackKeys.map(getWeShipMonthData)),
  ])

  if ('error' in shopifyResult) {
    return NextResponse.json({ error: shopifyResult.error }, { status: 500 })
  }

  // Merge XLSX maps for exact order-name matching (current ± adjacent months)
  const anyParsed = xlsxCurr.parsed || xlsxPrev.parsed || xlsxNext.parsed
  const mergedByOrder = new Map([
    ...xlsxNext.byOrder,
    ...xlsxPrev.byOrder,
    ...xlsxCurr.byOrder,
  ])

  // ── Build historical reference maps ──────────────────────────────────────────
  // Tracks total cost + per-position sums so we can show averaged line items.
  // weshipRef:       compositionKey               → ref  (position-agnostic match)
  // shippingRef:     compositionKey@countryCode   → ref  (preferred)
  // shippingRefAny:  compositionKey               → ref  (country-agnostic fallback)
  interface HistRef { sum: number; count: number; positions: Map<string, number> }
  function addRef(map: Map<string, HistRef>, key: string, total: number, items: { product: string; amount: number }[]) {
    const ref = map.get(key) ?? { sum: 0, count: 0, positions: new Map<string, number>() }
    ref.sum   += total
    ref.count += 1
    for (const { product, amount } of items) {
      ref.positions.set(product, (ref.positions.get(product) ?? 0) + amount)
    }
    map.set(key, ref)
  }
  function refToItems(ref: HistRef): { product: string; amount: number }[] {
    return Array.from(ref.positions.entries())
      .map(([product, sum]) => ({ product, amount: Math.round(sum / ref.count * 100) / 100 }))
      .filter(it => it.amount > 0)
  }

  const weshipRef      = new Map<string, HistRef>()
  const shippingRef    = new Map<string, HistRef>()
  const shippingRefAny = new Map<string, HistRef>()

  for (let i = 0; i < LOOKBACK; i++) {
    const histXlsx = lookbackXlsx[i]
    if (!histXlsx.parsed) continue

    for (const o of lookbackShopify[i].orders) {
      if (o.cancelled_at || o.financial_status === 'voided') continue
      const entry = histXlsx.byOrder.get(o.name)
      if (!entry) continue

      const ck = compositionKey(o.line_items)
      const cc = o.shipping_address?.country_code ?? o.billing_address?.country_code ?? 'XX'

      addRef(weshipRef,      ck,            entry.weship,   entry.weshipItems)
      addRef(shippingRef,    `${ck}@${cc}`, entry.shipping, entry.shippingItems)
      addRef(shippingRefAny, ck,            entry.shipping, entry.shippingItems)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const rawOrders = shopifyResult.orders

  const rows: OrderRow[] = rawOrders
    .filter(o => !o.cancelled_at && o.financial_status !== 'voided')
    .map(o => {
      const gross    = parseFloat(o.total_price)     || 0
      const tax      = parseFloat(o.total_tax)       || 0
      const net      = gross - tax
      const discount = parseFloat(o.total_discounts) || 0

      // Production COGS (always computed from config)
      let est_manufacturing = 0
      let est_ib_shipping   = 0
      for (const li of o.line_items) {
        const p = getCosts(li.title)
        est_manufacturing += p.manufacturing * li.quantity
        est_ib_shipping   += p.ib_shipping   * li.quantity
      }

      // Priority: 1) actual XLSX  2) historical average  3) no data (0)
      const xlsxEntry = mergedByOrder.get(o.name)
      const hasXlsx   = anyParsed && xlsxEntry !== undefined

      const ck = compositionKey(o.line_items)
      const cc = o.shipping_address?.country_code ?? o.billing_address?.country_code ?? 'XX'

      let cost_weship:        number
      let cost_shipping:      number
      let weship_source:      OrderRow['weship_source']
      let shipping_source:    OrderRow['shipping_source']
      let hist_weship_items:  { product: string; amount: number }[] | undefined
      let hist_shipping_items: { product: string; amount: number }[] | undefined

      if (hasXlsx) {
        cost_weship     = Math.round(xlsxEntry!.weship   * 100) / 100
        cost_shipping   = Math.round(xlsxEntry!.shipping * 100) / 100
        weship_source   = 'actual'
        shipping_source = 'actual'
      } else {
        const wRef = weshipRef.get(ck)
        if (wRef && wRef.count > 0) {
          cost_weship       = Math.round(wRef.sum / wRef.count * 100) / 100
          weship_source     = 'historical'
          hist_weship_items = refToItems(wRef)
        } else {
          cost_weship   = 0
          weship_source = 'estimated'
        }

        const sRef = shippingRef.get(`${ck}@${cc}`) ?? shippingRefAny.get(ck)
        if (sRef && sRef.count > 0) {
          cost_shipping        = Math.round(sRef.sum / sRef.count * 100) / 100
          shipping_source      = 'historical'
          hist_shipping_items  = refToItems(sRef)
        } else {
          cost_shipping   = 0
          shipping_source = 'estimated'
        }
      }

      const cost_production = Math.round((est_manufacturing + est_ib_shipping) * 100) / 100
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
        weship_source,
        shipping_source,
        weship_items:   hasXlsx ? xlsxEntry!.weshipItems   : hist_weship_items,
        shipping_items: hasXlsx ? xlsxEntry!.shippingItems : hist_shipping_items,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({
    orders: rows,
    xlsx: {
      parsed:     anyParsed,
      matched:    rows.filter(r => r.weship_source === 'actual').length,
      historical: rows.filter(r => r.weship_source === 'historical').length,
      estimated:  rows.filter(r => r.weship_source === 'estimated').length,
      debug:      xlsxCurr.debug,
    },
  })
}
