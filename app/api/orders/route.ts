import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyOrder } from '@/lib/shopify/client'
import type { OrderRow } from '@/lib/types'
import { getWeShipMonthData } from '@/lib/weship/xlsx-parser'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_PRODUCT_COSTS, applyOverrides, buildAmountsMap } from '@/lib/costs-config'
import { allMonthsInRange, offsetYM } from '@/lib/date-range'
export type { OrderRow }

// ─── Per-product cost profiles (last-resort COGS fallback) ────────────────────
// Used only when no actual XLSX data AND no historical reference exists.

interface CostProfile {
  manufacturing: number
  ib_shipping:   number
  weship:        number
  shipping:      number
  mfg_position:  string   // e.g. "Production costs (EXW)"
  mfg_supplier:  string   // e.g. "Quanzhou Pengxin Bags"
  ib_position:   string   // e.g. "Shipping & Customs to Graz"
  ib_supplier:   string   // e.g. "Shenzhen Amanda"
}

// Shared position/supplier label sets
const QP_SA = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Quanzhou Pengxin Bags', ib_position: 'Shipping & Customs to Graz', ib_supplier: 'Shenzhen Amanda' }
const LC_SA = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Licheng Plastic',        ib_position: 'Shipping & Customs to Graz', ib_supplier: 'Shenzhen Amanda' }
const DW_LP = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Dongguan Webbing',       ib_position: 'Packaging (EXW)',            ib_supplier: 'Langhai Printing' }

const COST_MAP: [string, CostProfile][] = [
  ['squad',         { manufacturing: 27.03, ib_shipping: 11.67, weship: 4.20, shipping: 5.40, ...QP_SA }],
  ['bundle l',      { manufacturing: 11.20, ib_shipping:  5.35, weship: 3.89, shipping: 5.40, ...QP_SA }],
  ['bundle m',      { manufacturing: 10.76, ib_shipping:  3.89, weship: 3.50, shipping: 5.40, ...QP_SA }],
  ['bundle s',      { manufacturing:  9.45, ib_shipping:  3.89, weship: 3.50, shipping: 5.40, ...QP_SA }],
  ['full set',      { manufacturing:  9.01, ib_shipping:  3.89, weship: 3.04, shipping: 5.40, ...QP_SA }],
  ['water bladder', { manufacturing:  2.53, ib_shipping:  0.40, weship: 3.05, shipping: 2.50, ...QP_SA }],
  ['cleaning kit',  { manufacturing:  1.75, ib_shipping:  1.46, weship: 3.05, shipping: 5.40, ...LC_SA }],
  ['phone strap',   { manufacturing:  0.33, ib_shipping:  0.11, weship: 3.04, shipping: 2.50, ...DW_LP }],
]

function getCosts(title: string, amountsMap: Map<string, { manufacturing: number; ib_shipping: number }>): CostProfile {
  const t = title.toLowerCase()
  for (const [key, profile] of COST_MAP) {
    if (t.includes(key)) {
      const ov = amountsMap.get(key)
      return ov ? { ...profile, manufacturing: ov.manufacturing, ib_shipping: ov.ib_shipping } : profile
    }
  }
  return { manufacturing: 0, ib_shipping: 0, weship: 0, shipping: 0, ...QP_SA }
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
  const fromParam  = req.nextUrl.searchParams.get('from')
  const toParam    = req.nextUrl.searchParams.get('to')
  const monthParam = req.nextUrl.searchParams.get('month')

  let from: Date, to: Date
  if (fromParam && toParam) {
    from = new Date(fromParam)
    to   = new Date(toParam)
  } else if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    from = new Date(y, m - 1, 1)
    to   = new Date(y, m, 0, 23, 59, 59)
  } else {
    // default: last complete month
    const now = new Date()
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  }

  // Load persisted cost amounts (production + IB shipping) from Supabase config
  let amountsMap = new Map<string, { manufacturing: number; ib_shipping: number }>()
  try {
    const cfgClient = createServerClient()
    const { data: cfgData } = await cfgClient.storage
      .from('weship-invoices')
      .download('config/production-costs.json')
    if (cfgData) {
      const overrides = JSON.parse(await cfgData.text()) as Record<string, Record<string, number>>
      amountsMap = buildAmountsMap(applyOverrides(overrides))
    }
  } catch {
    amountsMap = buildAmountsMap(DEFAULT_PRODUCT_COSTS)
  }

  // All months covered by the selected range (for XLSX matching)
  const rangeMonths  = allMonthsInRange(from, to)
  const xlsxMonths   = [offsetYM(rangeMonths[0], -1), ...rangeMonths, offsetYM(rangeMonths[rangeMonths.length - 1], +1)]
  const lookbackKeys = Array.from({ length: LOOKBACK }, (_, i) => offsetYM(rangeMonths[0], -(i + 1)))

  // All fetches in parallel: Shopify orders + XLSX for range months + lookback
  const [
    [shopifyResult, ...xlsxResults],
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
      ...xlsxMonths.map(getWeShipMonthData),
    ] as const),
    Promise.all(lookbackKeys.map(fetchMonthOrders)),
    Promise.all(lookbackKeys.map(getWeShipMonthData)),
  ])

  if ('error' in shopifyResult) {
    return NextResponse.json({ error: shopifyResult.error }, { status: 500 })
  }

  // Merge XLSX maps for all months in range (+ buffer months)
  const anyParsed    = xlsxResults.some(r => r.parsed)
  const mergedByOrder = new Map(xlsxResults.flatMap(r => [...r.byOrder]))

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
        const p = getCosts(li.title, amountsMap)
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
          const p = getCosts(li.title, amountsMap)
          return {
            title:              li.title,
            qty:                li.quantity,
            unit_price:         Math.round((parseFloat(li.price) || 0) * 100) / 100,
            cost_manufacturing: p.manufacturing,
            cost_ib_shipping:   p.ib_shipping,
            cost_production:    Math.round((p.manufacturing + p.ib_shipping) * 100) / 100,
            cost_weship:        p.weship,
            cost_shipping:      p.shipping,
            mfg_position:       p.mfg_position,
            mfg_supplier:       p.mfg_supplier,
            ib_position:        p.ib_position,
            ib_supplier:        p.ib_supplier,
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
      debug:      (xlsxResults.find(r => r.parsed) ?? xlsxResults[1])?.debug,
    },
  })
}
