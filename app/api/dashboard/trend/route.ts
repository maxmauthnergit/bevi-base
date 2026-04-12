import { NextRequest, NextResponse } from 'next/server'
import { getTrendDataForMonth } from '@/lib/shopify/queries'
import { getDailySpendForRange } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams
  const year  = parseInt(sp.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59)

  const [shopifyDays, metaSpend] = await Promise.all([
    getTrendDataForMonth(year, month).catch(() => null),
    getDailySpendForRange(from, to).catch(() => null),
  ])

  if (!shopifyDays) {
    return NextResponse.json({ error: 'Shopify fetch failed' }, { status: 500 })
  }

  const days = shopifyDays.map((day) => {
    const m = metaSpend?.find((d) => d.date === day.date)
    return { ...day, meta_spend: m?.spend ?? 0 }
  })

  return NextResponse.json({ year, month, days })
}
