import { NextRequest, NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    fields:         'id,created_at,financial_status,cancelled_at',
  })

  const orders = await shopifyFetchAllOrders(params, { revalidate: 0 })

  const byHour = new Array<number>(24).fill(0)
  const byDay  = new Array<number>(7).fill(0)

  const tzFmt = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour:     'numeric',
    weekday:  'short',
    hour12:   false,
  })

  for (const order of orders) {
    if (order.financial_status === 'voided' || order.cancelled_at) continue
    const d       = new Date(order.created_at)
    const parts   = tzFmt.formatToParts(d)
    const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0'
    const dayStr  = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
    const hour    = parseInt(hourStr === '24' ? '0' : hourStr, 10)
    const dayIdx  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayStr)
    if (hour >= 0 && hour < 24)  byHour[hour]++
    if (dayIdx >= 0)             byDay[dayIdx]++
  }

  const by_hour = byHour
    .map((orders, h) => ({
      hour:   h,
      label:  `${String(h).padStart(2, '0')}:00 – ${String((h + 1) % 24).padStart(2, '0')}:00`,
      orders,
    }))
    .sort((a, b) => b.orders - a.orders)

  const by_day = byDay
    .map((orders, d) => ({ day: d, label: DAY_LABELS[d], orders }))
    .sort((a, b) => b.orders - a.orders)

  return NextResponse.json({ by_hour, by_day })
}
