import { NextRequest, NextResponse } from 'next/server'
import { getTrendDataForMonth, getTrendDataForRange, getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import { getDailySpendForRange } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

function mergeMetaSpend(shopifyDays: Awaited<ReturnType<typeof getTrendDataForRange>>, metaSpend: { date: string; spend: number }[] | null) {
  return shopifyDays.map((day) => {
    const m = metaSpend?.find((d) => d.date === day.date)
    return { ...day, meta_spend: m?.spend ?? 0 }
  })
}

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')

  // Date-range mode (used by dashboard with DateRangeBar)
  if (from && to) {
    const tz       = await getShopTimezone()
    const fromDate = parseInTimezone(from, '00:00:00', tz)
    const toDate   = parseInTimezone(to,   '23:59:59', tz)

    const [shopifyDays, metaSpend] = await Promise.all([
      getTrendDataForRange(fromDate, toDate).catch(() => null),
      getDailySpendForRange(fromDate, toDate).catch(() => null),
    ])

    if (!shopifyDays) return NextResponse.json({ error: 'Shopify fetch failed' }, { status: 500 })

    return NextResponse.json({ from, to, days: mergeMetaSpend(shopifyDays, metaSpend) })
  }

  // Legacy month mode (kept for other callers)
  const year  = parseInt(sp.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  const fromDate = new Date(year, month - 1, 1)
  const toDate   = new Date(year, month, 0, 23, 59, 59)

  const [shopifyDays, metaSpend] = await Promise.all([
    getTrendDataForMonth(year, month).catch(() => null),
    getDailySpendForRange(fromDate, toDate).catch(() => null),
  ])

  if (!shopifyDays) return NextResponse.json({ error: 'Shopify fetch failed' }, { status: 500 })

  return NextResponse.json({ year, month, days: mergeMetaSpend(shopifyDays, metaSpend) })
}
