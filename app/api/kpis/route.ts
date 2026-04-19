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

  // Comparison period: same duration, immediately before current range
  const prevToDate   = new Date(fromDate.getTime() - 1)
  const prevFromDate = new Date(prevToDate.getTime() - durMs)

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

  const cRevNet  = c?.revenue_net   ?? 0
  const pRevNet  = p?.revenue_net   ?? 0
  const cOrders  = c?.order_count   ?? 0
  const pOrders  = p?.order_count   ?? 0
  const cUnits   = c?.unit_count    ?? 0
  const pUnits   = p?.unit_count    ?? 0
  const cAov     = cOrders > 0 ? cRevNet / cOrders : 0
  const pAov     = pOrders > 0 ? pRevNet / pOrders : 0
  const cCpo     = cOrders > 0 ? cs / cOrders : 0
  const pCpo     = pOrders > 0 ? ps / pOrders : 0

  return NextResponse.json({
    kpis: {
      revenue_net:    mkKpi('revenue_net',    cRevNet, pRevNet, true),
      orders:         mkKpi('orders',         cOrders, pOrders, true),
      units_sold:     mkKpi('units_sold',     cUnits,  pUnits,  true),
      meta_spend:     mkKpi('meta_spend',     cs,      ps,      false),
      aov:            mkKpi('aov',            cAov,    pAov,    true),
      cost_per_order: mkKpi('cost_per_order', cCpo,    pCpo,    false),
    },
    period:     { from, to },
    compPeriod: { from: toISO(prevFromDate), to: toISO(prevToDate) },
  })
}
