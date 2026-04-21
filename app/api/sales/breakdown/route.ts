import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone, parseInTimezone, getBundleOrderIdsForRange } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

function toFloat(s: string) { return parseFloat(s) || 0 }

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const tz       = await getShopTimezone()
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)

  const params = new URLSearchParams({
    status:         'any',
    created_at_min: fromDate.toISOString(),
    created_at_max: toDate.toISOString(),
    limit:          '250',
    fields:         'id,total_price,financial_status,cancelled_at,refunds,line_items,shipping_address,billing_address',
  })

  const [ordersRes, bundleIdsRes] = await Promise.allSettled([
    shopifyFetchAllOrders(params, { revalidate: 0 }),
    getBundleOrderIdsForRange(fromDate, toDate),
  ])

  const orders    = ordersRes.status    === 'fulfilled' ? ordersRes.value    : []
  const bundleIds = bundleIdsRes.status === 'fulfilled' ? bundleIdsRes.value : new Set<number>()

  const byProduct = new Map<string, number>()
  const byMarket  = new Map<string, number>()
  let bundle_revenue     = 0
  let non_bundle_revenue = 0
  let bundle_orders      = 0
  let non_bundle_orders  = 0

  for (const order of orders) {
    if (order.financial_status === 'voided' || order.cancelled_at) continue

    const gross = toFloat(order.total_price)
    const refundAmt = (order.refunds ?? [])
      .flatMap(r => r.transactions ?? [])
      .filter(t => t.kind === 'refund' && t.status === 'success')
      .reduce((s, t) => s + toFloat(t.amount), 0)
    const revenue = gross - refundAmt

    // By market
    const country = order.shipping_address?.country_code
      ?? order.billing_address?.country_code
      ?? 'Unknown'
    byMarket.set(country, (byMarket.get(country) ?? 0) + revenue)

    // By product (from line item prices)
    for (const li of order.line_items) {
      const liRevenue = toFloat(li.price) * li.quantity
      byProduct.set(li.title, (byProduct.get(li.title) ?? 0) + liRevenue)
    }

    // Bundle split
    if (bundleIds.has(order.id)) {
      bundle_revenue += revenue
      bundle_orders++
    } else {
      non_bundle_revenue += revenue
      non_bundle_orders++
    }
  }

  const by_product = Array.from(byProduct.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([title, revenue]) => ({ title, revenue: Math.round(revenue) }))

  const by_market = Array.from(byMarket.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([country, revenue]) => ({ country, revenue: Math.round(revenue) }))

  return NextResponse.json({
    by_product,
    by_market,
    bundle_split: {
      bundle_revenue:     Math.round(bundle_revenue),
      non_bundle_revenue: Math.round(non_bundle_revenue),
      bundle_orders,
      non_bundle_orders,
    },
  })
}
