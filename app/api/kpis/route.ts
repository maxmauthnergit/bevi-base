import { NextRequest, NextResponse } from 'next/server'
import { getOrderKpisForRange } from '@/lib/shopify/queries'
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

  const fromDate = new Date(from + 'T00:00:00')
  const toDate   = new Date(to   + 'T23:59:59')
  const durMs    = toDate.getTime() - fromDate.getTime()

  const preset = req.nextUrl.searchParams.get('preset')
  const month  = req.nextUrl.searchParams.get('month')

  // Comparison period
  let prevFromDate: Date
  let prevToDate: Date

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const prevM   = m === 1 ? 12 : m - 1
    const prevY   = m === 1 ? y - 1 : y
    prevFromDate  = new Date(prevY, prevM - 1, 1, 0, 0, 0)
    const lastDay = new Date(prevY, prevM, 0).getDate()
    const toDay   = Math.min(toDate.getDate(), lastDay)
    prevToDate    = new Date(prevY, prevM - 1, toDay, 23, 59, 59)
  } else if (preset === 'last-month') {
    prevToDate   = new Date(fromDate.getFullYear(), fromDate.getMonth(), 0, 23, 59, 59)
    prevFromDate = new Date(prevToDate.getFullYear(), prevToDate.getMonth(), 1, 0, 0, 0)
  } else if (preset === 'last-quarter') {
    prevToDate   = new Date(fromDate.getTime() - 86_400_000)
    prevToDate.setHours(23, 59, 59, 999)
    const qStart = Math.floor(prevToDate.getMonth() / 3) * 3
    prevFromDate = new Date(prevToDate.getFullYear(), qStart, 1, 0, 0, 0)
  } else if (preset === 'ytd') {
    const prevY  = fromDate.getFullYear() - 1
    prevFromDate = new Date(prevY, 0, 1, 0, 0, 0)
    prevToDate   = new Date(prevY, toDate.getMonth(), toDate.getDate(), 23, 59, 59)
  } else if (preset === 'last-year') {
    const prevY  = fromDate.getFullYear() - 1
    prevFromDate = new Date(prevY, 0, 1, 0, 0, 0)
    prevToDate   = new Date(prevY, 11, 31, 23, 59, 59)
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
