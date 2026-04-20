import { NextRequest, NextResponse } from 'next/server'
import { getTrendDataForMonth, getTrendDataForRange, getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import { getDailySpendForRange } from '@/lib/meta/queries'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_PRODUCT_COSTS, applyOverrides, buildAmountsMap } from '@/lib/costs-config'

export const dynamic = 'force-dynamic'

function mergeMetaSpend(shopifyDays: Awaited<ReturnType<typeof getTrendDataForRange>>, metaSpend: { date: string; spend: number }[] | null) {
  return shopifyDays.map((day) => {
    const m = metaSpend?.find((d) => d.date === day.date)
    return { ...day, meta_spend: m?.spend ?? 0 }
  })
}

async function loadAmountsMap() {
  try {
    const client = createServerClient()
    const { data } = await client.storage
      .from('weship-invoices')
      .download('config/production-costs.json')
    if (data) {
      const overrides = JSON.parse(await data.text()) as Record<string, Record<string, number>>
      return buildAmountsMap(applyOverrides(overrides))
    }
  } catch { /* fall through */ }
  return buildAmountsMap(DEFAULT_PRODUCT_COSTS)
}

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')

  // Date-range mode (used by dashboard with DateRangeBar)
  if (from && to) {
    const [tz, amountsMap] = await Promise.all([getShopTimezone(), loadAmountsMap()])
    const fromDate = parseInTimezone(from, '00:00:00', tz)
    const toDate   = parseInTimezone(to,   '23:59:59', tz)

    const [shopifyDays, metaSpend] = await Promise.all([
      getTrendDataForRange(fromDate, toDate, amountsMap).catch(() => null),
      getDailySpendForRange(fromDate, toDate, tz).catch(() => null),
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

  const [amountsMap, tz] = await Promise.all([loadAmountsMap(), getShopTimezone()])

  const [shopifyDays, metaSpend] = await Promise.all([
    getTrendDataForMonth(year, month, amountsMap).catch(() => null),
    getDailySpendForRange(fromDate, toDate, tz).catch(() => null),
  ])

  if (!shopifyDays) return NextResponse.json({ error: 'Shopify fetch failed' }, { status: 500 })

  return NextResponse.json({ year, month, days: mergeMetaSpend(shopifyDays, metaSpend) })
}
