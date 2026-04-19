import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetch, shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'processed_at', 'financial_status', 'cancelled_at',
  'total_price', 'total_tax', 'refunds',
].join(',')

function toFloat(s: string) { return parseFloat(s) || 0 }

function summarise(orders: any[], tz: string) {
  const byStatus: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let totalPrice = 0
  let totalRefunds = 0
  let countNonVoided = 0

  for (const order of orders) {
    byStatus[order.financial_status] = (byStatus[order.financial_status] ?? 0) + 1
    if (order.financial_status !== 'voided') {
      countNonVoided++
      if (!order.cancelled_at) {
        totalPrice += toFloat(order.total_price)
        const refAmt = (order.refunds ?? [])
          .flatMap((r: any) => r.transactions ?? [])
          .filter((t: any) => t.kind === 'refund' && t.status === 'success')
          .reduce((s: number, t: any) => s + toFloat(t.amount), 0)
        totalRefunds += refAmt
      }
    }
    // Daily distribution in store timezone
    const localDate = new Date(order.created_at).toLocaleDateString('sv', { timeZone: tz })
    byDay[localDate] = (byDay[localDate] ?? 0) + 1
  }

  return {
    total_fetched: orders.length,
    count_non_voided: countNonVoided,
    by_financial_status: byStatus,
    revenue_gross: Math.round(totalPrice * 100) / 100,
    total_refunds: Math.round(totalRefunds * 100) / 100,
    revenue_net_of_refunds: Math.round((totalPrice - totalRefunds) * 100) / 100,
    orders_per_day: Object.fromEntries(Object.entries(byDay).sort()),
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const tz       = await getShopTimezone()
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)

  const base = { status: 'any', limit: '250', fields: ORDER_FIELDS }
  const fromISO = fromDate.toISOString()
  const toISO   = toDate.toISOString()

  // Shopify count endpoint — authoritative total, no pagination needed
  const [countResult, byCreatedAt, byProcessedAt] = await Promise.all([
    shopifyFetch<{ count: number }>(
      `/orders/count.json?status=any&created_at_min=${fromISO}&created_at_max=${toISO}`,
      { next: { revalidate: 0 } }
    ),
    shopifyFetchAllOrders(new URLSearchParams({
      ...base, created_at_min: fromISO, created_at_max: toISO,
    }), { revalidate: 0 }),
    shopifyFetchAllOrders(new URLSearchParams({
      ...base, processed_at_min: fromISO, processed_at_max: toISO,
    }), { revalidate: 0 }),
  ])

  return NextResponse.json({
    tz,
    range: { from, to, from_utc: fromISO, to_utc: toISO },
    shopify_api_count:  countResult.count,
    by_created_at:      summarise(byCreatedAt,   tz),
    by_processed_at:    summarise(byProcessedAt, tz),
  })
}
