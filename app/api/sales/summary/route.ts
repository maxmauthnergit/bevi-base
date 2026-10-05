import { NextRequest, NextResponse } from 'next/server'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import {
  getSalesSummaryFromShopifyQL, getSalesSummaryFromOrders,
  type SalesSummary, type SalesSummarySource,
} from '@/lib/shopify/sales-summary'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') // YYYY-MM-DD
  const to   = req.nextUrl.searchParams.get('to')   // YYYY-MM-DD

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 })
  }

  let summary: SalesSummary
  let source: SalesSummarySource = 'shopifyql'
  let fallbackReason: string | undefined

  try {
    summary = await getSalesSummaryFromShopifyQL(from, to)
  } catch (err) {
    // Until the token carries read_reports + protected customer data access,
    // ShopifyQL is refused — fall back to computing the breakdown from orders.
    fallbackReason = (err as Error).message
    console.warn('[sales/summary] ShopifyQL failed, falling back to orders:', fallbackReason)
    try {
      const tz = await getShopTimezone()
      summary = await getSalesSummaryFromOrders(
        parseInTimezone(from, '00:00:00', tz),
        parseInTimezone(to,   '23:59:59', tz),
      )
      source = 'orders'
    } catch (err2) {
      return NextResponse.json({ error: (err2 as Error).message }, { status: 500 })
    }
  }

  return NextResponse.json({ summary, source, fallbackReason, period: { from, to } })
}
