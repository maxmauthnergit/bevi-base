import { NextRequest, NextResponse } from 'next/server'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import { getSalesSummaryForRange } from '@/lib/shopify/sales-summary'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') // YYYY-MM-DD
  const to   = req.nextUrl.searchParams.get('to')   // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  try {
    const tz      = await getShopTimezone()
    const summary = await getSalesSummaryForRange(
      parseInTimezone(from, '00:00:00', tz),
      parseInTimezone(to,   '23:59:59', tz),
    )
    return NextResponse.json({ summary, period: { from, to } })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
