import { NextRequest, NextResponse } from 'next/server'
import { getOrderKpisForRange, getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import { getMetaSpendForRange } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

function mkKpi(id: string, value: number, prev: number, isPositiveUp: boolean) {
  const delta        = Math.round((value - prev) * 100) / 100
  const deltaPercent = prev !== 0 ? Math.round((delta / prev) * 1000) / 10 : 0
  return {
    metricId:      id,
    value:         Math.round(value * 100) / 100,
    previousValue: Math.round(prev  * 100) / 100,
    delta,
    deltaPercent,
    trend:         delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    isPositiveUp,
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') // YYYY-MM-DD
  const to   = req.nextUrl.searchParams.get('to')   // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const tz       = await getShopTimezone()
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)
  const durMs    = toDate.getTime() - fromDate.getTime()

  const preset = req.nextUrl.searchParams.get('preset')
  const month  = req.nextUrl.searchParams.get('month')

  // Comparison period
  let prevFromDate: Date
  let prevToDate: Date

  // Helper: build comparison boundaries using the store timezone
  const ptz = (dateStr: string, t: '00:00:00' | '23:59:59') => parseInTimezone(dateStr, t, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ds  = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

  // from/to as a wall-clock date in the store timezone (for calendar-aware presets)
  const fromWall = new Date(from + 'T12:00:00Z') // noon UTC ≈ correct calendar date anywhere
  const toWall   = new Date(to   + 'T12:00:00Z')

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const prevM   = m === 1 ? 12 : m - 1
    const prevY   = m === 1 ? y - 1 : y
    const lastDay = new Date(prevY, prevM, 0).getDate()
    const toDay   = Math.min(toWall.getUTCDate(), lastDay)
    prevFromDate  = ptz(ds(prevY, prevM, 1),     '00:00:00')
    prevToDate    = ptz(ds(prevY, prevM, toDay), '23:59:59')
  } else if (preset === 'last-month') {
    const prevTo = new Date(Date.UTC(fromWall.getUTCFullYear(), fromWall.getUTCMonth(), 0))
    prevFromDate = ptz(ds(prevTo.getUTCFullYear(), prevTo.getUTCMonth() + 1, 1), '00:00:00')
    prevToDate   = ptz(ds(prevTo.getUTCFullYear(), prevTo.getUTCMonth() + 1, prevTo.getUTCDate()), '23:59:59')
  } else if (preset === 'last-quarter') {
    const prevTo   = new Date(fromDate.getTime() - 86_400_000)
    const qStart   = Math.floor(prevTo.getUTCMonth() / 3) * 3
    prevFromDate   = ptz(ds(prevTo.getUTCFullYear(), qStart + 1, 1), '00:00:00')
    prevToDate     = ptz(ds(prevTo.getUTCFullYear(), qStart + 3, new Date(prevTo.getUTCFullYear(), qStart + 3, 0).getDate()), '23:59:59')
  } else if (preset === 'ytd') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1), '00:00:00')
    prevToDate   = ptz(ds(prevY, toWall.getUTCMonth() + 1, toWall.getUTCDate()), '23:59:59')
  } else if (preset === 'last-year') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1),   '00:00:00')
    prevToDate   = ptz(ds(prevY, 12, 31), '23:59:59')
  } else {
    // today, yesterday, last-7, last-30, custom: same duration shifted back
    prevToDate   = new Date(fromDate.getTime() - 1)
    prevFromDate = new Date(prevToDate.getTime() - durMs)
  }

  const [curr, prev, currSpend, prevSpend] = await Promise.allSettled([
    getOrderKpisForRange(fromDate, toDate),
    getOrderKpisForRange(prevFromDate, prevToDate),
    getMetaSpendForRange(fromDate, toDate),
    getMetaSpendForRange(prevFromDate, prevToDate),
  ])

  const c = curr.status     === 'fulfilled' ? curr.value     : null
  const p = prev.status     === 'fulfilled' ? prev.value     : null
  const cs = currSpend.status === 'fulfilled' ? currSpend.value : 0
  const ps = prevSpend.status === 'fulfilled' ? prevSpend.value : 0

  const cRevGross = c?.revenue_gross ?? 0
  const pRevGross = p?.revenue_gross ?? 0
  const cRevNet   = c?.revenue_net   ?? 0
  const pRevNet   = p?.revenue_net   ?? 0
  const cOrders   = c?.order_count   ?? 0
  const pOrders   = p?.order_count   ?? 0
  const cUnits    = c?.unit_count    ?? 0
  const pUnits    = p?.unit_count    ?? 0
  const cAov      = cOrders > 0 ? cRevNet / cOrders : 0
  const pAov      = pOrders > 0 ? pRevNet / pOrders : 0

  return NextResponse.json({
    kpis: {
      revenue_gross: mkKpi('revenue_gross', cRevGross, pRevGross, true),
      revenue_net:   mkKpi('revenue_net',   cRevNet,   pRevNet,   true),
      orders:        mkKpi('orders',        cOrders,   pOrders,   true),
      units_sold:    mkKpi('units_sold',    cUnits,    pUnits,    true),
      meta_spend:    mkKpi('meta_spend',    cs,        ps,        false),
      aov:           mkKpi('aov',           cAov,      pAov,      true),
    },
    period:     { from, to },
    compPeriod: { from: toISO(prevFromDate), to: toISO(prevToDate) },
  })
}
