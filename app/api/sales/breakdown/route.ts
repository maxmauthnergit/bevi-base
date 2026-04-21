import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'

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

  const orders = await shopifyFetchAllOrders(params, { revalidate: 0 })

  const byProduct = new Map<string, number>()
  const byMarket  = new Map<string, number>()

  for (const order of orders) {
    if (order.financial_status === 'voided' || order.cancelled_at) continue

    const gross = toFloat(order.total_price)
    const refundAmt = (order.refunds ?? [])
      .flatMap(r => r.transactions ?? [])
      .filter(t => t.kind === 'refund' && t.status === 'success')
      .reduce((s, t) => s + toFloat(t.amount), 0)
    const revenue = gross - refundAmt

    const country = order.shipping_address?.country_code
      ?? order.billing_address?.country_code
      ?? 'Unknown'
    byMarket.set(country, (byMarket.get(country) ?? 0) + revenue)

    for (const li of order.line_items) {
      const key       = `${li.title}|||${li.variant_title ?? ''}`
      const liRevenue = toFloat(li.price) * li.quantity
      byProduct.set(key, (byProduct.get(key) ?? 0) + liRevenue)
    }
  }

  const by_product = Array.from(byProduct.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 14)
    .map(([key, revenue]) => {
      const [title, variant] = key.split('|||')
      return { title, variant: variant || null, revenue: Math.round(revenue) }
    })

  const by_market = Array.from(byMarket.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([country, revenue]) => ({ country, revenue: Math.round(revenue) }))

  return NextResponse.json({ by_product, by_market })
}
