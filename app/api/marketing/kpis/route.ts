import { NextRequest, NextResponse } from 'next/server'
import { getOrderKpisForRange, getShopTimezone, parseInTimezone } from '@/lib/shopify/queries'
import { getMetaInsightsForRange } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

function isoInTZ(d: Date, tz: string) {
  return d.toLocaleDateString('sv', { timeZone: tz })
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
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const tz       = await getShopTimezone()
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)
  const durMs    = toDate.getTime() - fromDate.getTime()

  const preset = req.nextUrl.searchParams.get('preset')
  const month  = req.nextUrl.searchParams.get('month')

  const ptz = (dateStr: string, t: '00:00:00' | '23:59:59') => parseInTimezone(dateStr, t, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ds  = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

  const fromWall = new Date(from + 'T12:00:00Z')
  const toWall   = new Date(to   + 'T12:00:00Z')

  let prevFromDate: Date
  let prevToDate: Date

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
  } else if (preset === 'ytd') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1), '00:00:00')
    prevToDate   = ptz(ds(prevY, toWall.getUTCMonth() + 1, toWall.getUTCDate()), '23:59:59')
  } else if (preset === 'last-year') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1),   '00:00:00')
    prevToDate   = ptz(ds(prevY, 12, 31), '23:59:59')
  } else {
    prevToDate   = new Date(fromDate.getTime() - 1)
    prevFromDate = new Date(prevToDate.getTime() - durMs)
  }

  const [currMeta, prevMeta, currShopify, prevShopify] = await Promise.allSettled([
    getMetaInsightsForRange(fromDate, toDate, tz),
    getMetaInsightsForRange(prevFromDate, prevToDate, tz),
    getOrderKpisForRange(fromDate, toDate),
    getOrderKpisForRange(prevFromDate, prevToDate),
  ])

  const cm = currMeta.status    === 'fulfilled' ? currMeta.value    : null
  const pm = prevMeta.status    === 'fulfilled' ? prevMeta.value    : null
  const cs = currShopify.status === 'fulfilled' ? currShopify.value : null
  const ps = prevShopify.status === 'fulfilled' ? prevShopify.value : null

  const cSpend    = cm?.spend       ?? 0
  const pSpend    = pm?.spend       ?? 0
  const cRevenue  = cs?.revenue_gross ?? 0
  const pRevenue  = ps?.revenue_gross ?? 0
  const cOrders   = cs?.order_count   ?? 0
  const pOrders   = ps?.order_count   ?? 0

  const cBlendedRoas = cSpend > 0 ? cRevenue / cSpend : 0
  const pBlendedRoas = pSpend > 0 ? pRevenue / pSpend : 0
  const cMetaRoas    = cm?.meta_roas ?? 0
  const pMetaRoas    = pm?.meta_roas ?? 0
  const cCac         = cOrders > 0 ? cSpend / cOrders : 0
  const pCac         = pOrders > 0 ? pSpend / pOrders : 0
  const cCpm         = cm?.cpm ?? 0
  const pCpm         = pm?.cpm ?? 0
  const cCtr         = cm?.ctr ?? 0
  const pCtr         = pm?.ctr ?? 0

  return NextResponse.json({
    kpis: {
      ad_spend:      mkKpi('ad_spend',      cSpend,        pSpend,        false),
      blended_roas:  mkKpi('blended_roas',  cBlendedRoas,  pBlendedRoas,  true),
      meta_roas:     mkKpi('meta_roas',     cMetaRoas,     pMetaRoas,     true),
      cac:           mkKpi('cac',           cCac,          pCac,          false),
      cpm:           mkKpi('cpm',           cCpm,          pCpm,          false),
      ctr:           mkKpi('ctr',           cCtr,          pCtr,          true),
    },
    compPeriod: { from: isoInTZ(prevFromDate, tz), to: isoInTZ(prevToDate, tz) },
  })
}
