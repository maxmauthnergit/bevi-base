import { NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

function toFloat(s: string) { return parseFloat(s) || 0 }

export async function GET() {
  const tz = await getShopTimezone()

  const from = new Date('2024-11-01T00:00:00Z')
  const to   = new Date()

  const params = new URLSearchParams({
    status:          'any',
    created_at_min:  from.toISOString(),
    created_at_max:  to.toISOString(),
    limit:           '250',
    fields:          'id,created_at,total_price,total_tax,financial_status,cancelled_at,refunds',
  })

  const orders = await shopifyFetchAllOrders(params, { revalidate: 3600 })

  const byMonth = new Map<string, { revenue_gross: number; orders: number }>()

  for (const order of orders) {
    if (order.financial_status === 'voided') continue

    const monthKey = new Date(order.created_at)
      .toLocaleDateString('sv', { timeZone: tz })
      .slice(0, 7)

    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { revenue_gross: 0, orders: 0 })
    const entry = byMonth.get(monthKey)!

    entry.orders++

    if (!order.cancelled_at) {
      const gross = toFloat(order.total_price)
      const refundAmt = (order.refunds ?? [])
        .flatMap(r => r.transactions ?? [])
        .filter(t => t.kind === 'refund' && t.status === 'success')
        .reduce((s, t) => s + toFloat(t.amount), 0)
      entry.revenue_gross += gross - refundAmt
    }
  }

  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      revenue_gross: Math.round(d.revenue_gross),
      orders:        d.orders,
    }))

  return NextResponse.json({ months })
}
