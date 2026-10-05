import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import type { ShopifyOrder } from '@/lib/shopify/client'
import type { OrderRow } from '@/lib/types'
import { getCosts, loadAmountsMap, loadWeShipCosts } from '@/lib/order-costs'
import { allMonthsInRange } from '@/lib/date-range'
export type { OrderRow }

// ─── Route helpers ────────────────────────────────────────────────────────────

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'total_price', 'total_tax', 'total_discounts',
  'financial_status', 'fulfillment_status', 'cancel_reason', 'cancelled_at',
  'refunds', 'line_items', 'shipping_address', 'billing_address',
].join(',')


function fetchMonthOrders(m: string): Promise<{ orders: ShopifyOrder[] }> {
  const [y, mo] = m.split('-').map(Number)
  const from = new Date(y, mo - 1, 1)
  const to   = new Date(y, mo, 0, 23, 59, 59)
  return shopifyFetchAllOrders(
    new URLSearchParams({
      status:         'any',
      created_at_min: from.toISOString(),
      created_at_max: to.toISOString(),
      limit:          '250',
      fields:         ORDER_FIELDS,
    }),
  ).then(orders => ({ orders })).catch((): { orders: ShopifyOrder[] } => ({ orders: [] }))
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  // All months covered by the selected range (for XLSX matching)
  const rangeMonths = allMonthsInRange(from, to)

  // All fetches in parallel: cost config, Shopify orders, WeShip invoices + lookback
  const [amountsMap, shopifyResult, weshipCosts] = await Promise.all([
    loadAmountsMap(),
    shopifyFetchAllOrders(
      new URLSearchParams({
        status:         'any',
        created_at_min: from.toISOString(),
        created_at_max: to.toISOString(),
        limit:          '250',
        fields:         ORDER_FIELDS,
      }),
    ).then(orders => ({ orders })).catch((err: unknown) => ({ error: String(err) })),
    loadWeShipCosts(rangeMonths, m => fetchMonthOrders(m).then(r => r.orders)),
  ])

  if ('error' in shopifyResult) {
    return NextResponse.json({ error: shopifyResult.error }, { status: 500 })
  }

  const rawOrders = shopifyResult.orders

  const rows: OrderRow[] = rawOrders
    .filter(o => !o.cancelled_at && o.financial_status !== 'voided')
    .map(o => {
      const grossRaw  = parseFloat(o.total_price)     || 0
      const taxRaw    = parseFloat(o.total_tax)       || 0
      const discount  = parseFloat(o.total_discounts) || 0
      const refundAmt = (o.refunds ?? [])
        .flatMap(r => r.transactions ?? [])
        .filter(t => t.kind === 'refund' && t.status === 'success')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
      const gross = grossRaw - refundAmt
      const tax   = grossRaw > 0 ? taxRaw * (gross / grossRaw) : 0
      const net   = gross - tax

      // Production COGS (always computed from config)
      let est_manufacturing = 0
      let est_ib_shipping   = 0
      for (const li of o.line_items) {
        const p = getCosts(li.title, amountsMap)
        est_manufacturing += p.manufacturing * li.quantity
        est_ib_shipping   += p.ib_shipping   * li.quantity
      }

      // Priority: 1) actual XLSX  2) historical average  3) no data (0).
      // Return handling is part of the WeShip fulfillment figure here.
      const wc = weshipCosts.forOrder(o)
      const hasXlsx       = wc.weship_source === 'actual'
      const cost_weship   = Math.round((wc.weship + wc.returns) * 100) / 100
      const cost_shipping = wc.shipping

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
        weship_source:   wc.weship_source,
        shipping_source: wc.shipping_source,
        weship_items:    hasXlsx ? [...(wc.weship_items ?? []), ...(wc.returns_items ?? [])] : wc.weship_items,
        shipping_items:  wc.shipping_items,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({
    orders: rows,
    xlsx: {
      parsed:     weshipCosts.anyParsed,
      matched:    rows.filter(r => r.weship_source === 'actual').length,
      historical: rows.filter(r => r.weship_source === 'historical').length,
      estimated:  rows.filter(r => r.weship_source === 'estimated').length,
      debug:      weshipCosts.debug,
    },
  })
}
