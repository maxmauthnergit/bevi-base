import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'financial_status', 'cancelled_at',
  'total_price', 'total_tax', 'refunds',
].join(',')

function toFloat(s: string) { return parseFloat(s) || 0 }

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const tz       = await getShopTimezone()
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)

  const params = new URLSearchParams({
    status: 'any',
    created_at_min: fromDate.toISOString(),
    created_at_max: toDate.toISOString(),
    limit: '250',
    fields: ORDER_FIELDS,
  })

  const orders = await shopifyFetchAllOrders(params, { revalidate: 0 })

  // Breakdown by status
  const byStatus: Record<string, number> = {}
  const byCancelled = { cancelled: 0, not_cancelled: 0 }
  let totalPrice = 0
  let totalRefunds = 0
  let countNonVoided = 0
  let countNonVoidedNonCancelled = 0

  for (const order of orders) {
    byStatus[order.financial_status] = (byStatus[order.financial_status] ?? 0) + 1
    if (order.cancelled_at) byCancelled.cancelled++
    else byCancelled.not_cancelled++

    if (order.financial_status !== 'voided') {
      countNonVoided++
      if (!order.cancelled_at) {
        countNonVoidedNonCancelled++
        totalPrice += toFloat(order.total_price)
        const refAmt = (order.refunds ?? [])
          .flatMap((r: any) => r.transactions ?? [])
          .filter((t: any) => t.kind === 'refund' && t.status === 'success')
          .reduce((s: number, t: any) => s + toFloat(t.amount), 0)
        totalRefunds += refAmt
      }
    }
  }

  return NextResponse.json({
    tz,
    from_utc: fromDate.toISOString(),
    to_utc:   toDate.toISOString(),
    total_fetched:               orders.length,
    count_non_voided:            countNonVoided,
    count_non_voided_non_cancelled: countNonVoidedNonCancelled,
    by_financial_status:         byStatus,
    by_cancelled:                byCancelled,
    revenue_gross_before_refunds: Math.round(totalPrice * 100) / 100,
    total_refunds:               Math.round(totalRefunds * 100) / 100,
    revenue_gross_after_refunds: Math.round((totalPrice - totalRefunds) * 100) / 100,
  })
}
