import { NextRequest, NextResponse } from 'next/server'
import { getShopTimezone } from '@/lib/shopify/queries'
import { resolvePeriods, isoInTZ } from '@/lib/comparison-period'
import { loadUnitEconomicsContext, computePeriod, type PeriodResult } from '@/lib/kpis/unit-economics'
import type { UnitEconomics } from '@/lib/kpis/formulas'
import type { KpiValue } from '@/lib/types'
import { requireUser } from '@/lib/supabase/require-user'

export const dynamic = 'force-dynamic'
// Reads the full order history plus the WeShip invoices of every month in both periods
export const maxDuration = 60

const DAY = /^\d{4}-\d{2}-\d{2}$/

type NoteLines = { label: string; value: string }[]

const eur = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v) + ' €'
const x2  = (v: number | null) => (v === null ? '—' : v.toFixed(2))

function mkKpi(
  id: string,
  value: number | null,
  prev: number | null | undefined,
  isPositiveUp: boolean,
  noteLines: NoteLines,
  estimatedShare?: number,
): KpiValue {
  const est = estimatedShare && estimatedShare > 0.005 ? Math.round(estimatedShare * 1000) / 10 : undefined
  const base: KpiValue = {
    metricId: id,
    value:    value === null ? 0 : Math.round(value * 100) / 100,
    isPositiveUp,
    noteLines,
    ...(value === null ? { empty: true } : {}),
    ...(est !== undefined ? { estimatedShare: est } : {}),
  }
  if (value === null || prev === null || prev === undefined) return base
  const delta = Math.round((value - prev) * 100) / 100
  return {
    ...base,
    previousValue: Math.round(prev * 100) / 100,
    delta,
    deltaPercent: prev !== 0 ? Math.round((delta / Math.abs(prev)) * 1000) / 10 : 0,
    trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  }
}

function buildKpis(c: PeriodResult, p: PeriodResult | null): Record<string, KpiValue> {
  const m: UnitEconomics = c.metrics
  const pm = p?.metrics
  const i  = c.inputs
  const estCosts = c.metrics.cod > 0
    ? (c.estimated.cogs + c.estimated.fulfillment + c.estimated.fees) / c.metrics.cod
    : 0

  return {
    net_revenue: mkKpi('net_revenue', m.net_revenue, pm?.net_revenue, true, [
      { label: 'Net sales + shipping', value: 'excl. VAT' },
      { label: 'Net sales', value: eur(i.netSales) },
      { label: 'Shipping',  value: eur(i.shipping) },
    ]),
    aov: mkKpi('aov', m.aov, pm?.aov, true, [
      { label: 'Net revenue / orders', value: '' },
      { label: 'Net revenue', value: eur(m.net_revenue) },
      { label: 'Orders',      value: String(i.orders) },
    ]),
    ad_spend: mkKpi('ad_spend', m.ad_spend, pm?.ad_spend, false, [
      { label: 'Σ Meta spend', value: c.metaOk ? 'Meta Ads' : 'Meta unavailable' },
    ]),
    meta_roas: mkKpi('meta_roas', m.meta_roas, pm?.meta_roas, true, [
      { label: 'Meta purchase value / spend', value: '' },
      { label: 'Purchase value', value: eur(i.metaPurchaseValue) },
      { label: 'Meta-attributed', value: 'value as Meta reports it (incl. VAT)' },
    ]),
    mer: mkKpi('mer', m.mer, pm?.mer, true, [
      { label: 'Net revenue / ad spend', value: '' },
      { label: 'Net revenue', value: eur(m.net_revenue) },
      { label: 'Ad spend',    value: eur(m.ad_spend) },
      { label: 'vs. Meta ROAS', value: x2(m.meta_roas) },
    ]),
    ncac: mkKpi('ncac', m.ncac, pm?.ncac, false, [
      { label: 'Ad spend / new customers', value: '' },
      { label: 'Ad spend',      value: eur(m.ad_spend) },
      { label: 'New customers', value: String(i.newCustomers) },
      { label: 'All orders',    value: String(i.orders) },
    ]),
    contribution: mkKpi('contribution', m.contribution, pm?.contribution, true, [
      { label: 'Net revenue − COD − ad spend', value: '' },
      { label: 'Net revenue', value: eur(m.net_revenue) },
      { label: 'COD',         value: `−${eur(m.cod)}` },
      { label: 'Ad spend',    value: `−${eur(m.ad_spend)}` },
    ], estCosts),
    contribution_pct: mkKpi('contribution_pct', m.contribution_pct, pm?.contribution_pct, true, [
      { label: 'Contribution / net revenue', value: '' },
      { label: 'Contribution', value: eur(m.contribution) },
      { label: 'Net revenue',  value: eur(m.net_revenue) },
    ], estCosts),
    foc_to_ncac: mkKpi('foc_to_ncac', m.foc_to_ncac, pm?.foc_to_ncac, true, [
      { label: 'First-order contribution / nCAC', value: '' },
      { label: 'Contribution per new customer', value: m.first_order_contribution === null ? '—' : eur(m.first_order_contribution) },
      { label: 'nCAC', value: m.ncac === null ? '—' : eur(m.ncac) },
      { label: 'Before ad spend; > 1 = first order pays back', value: '' },
    ], estCosts),
  }
}

function waterfall(c: PeriodResult) {
  const { inputs: i, metrics: m, estimated: e } = c
  const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)
  return {
    net_revenue:  m.net_revenue,
    cogs:         i.cogs,
    fulfillment:  i.fulfillment,
    returns:      i.returnCosts,
    fees:         i.paymentFees,
    ad_spend:     m.ad_spend,
    contribution: m.contribution,
    storage:      c.storage,
    estimated: {
      cogs:        share(e.cogs, i.cogs),
      fulfillment: share(e.fulfillment, i.fulfillment),
      fees:        share(e.fees, i.paymentFees),
    },
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireUser()
  if (denied) return denied

  const from   = req.nextUrl.searchParams.get('from')
  const to     = req.nextUrl.searchParams.get('to')
  const preset = req.nextUrl.searchParams.get('preset')
  const month  = req.nextUrl.searchParams.get('month')

  if (!from || !to || !DAY.test(from) || !DAY.test(to)) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const tz = await getShopTimezone()
    const { fromDate, toDate, prev } = resolvePeriods({ from, to, preset, month, tz })
    const ctx = await loadUnitEconomicsContext()

    const [curr, prevRes] = await Promise.all([
      computePeriod(ctx, { fromDate, toDate }),
      prev ? computePeriod(ctx, prev).catch(() => null) : Promise.resolve(null),
    ])

    return NextResponse.json({
      kpis:       buildKpis(curr, prevRes),
      waterfall:  waterfall(curr),
      period:     { from, to },
      compPeriod: prev ? { from: isoInTZ(prev.fromDate, tz), to: isoInTZ(prev.toDate, tz) } : null,
      sources: {
        revenue: curr.revenueSource,
        meta:    curr.metaOk,
        lots:    ctx.lotCount,
        unmappedUnits: ctx.unmappedUnits,
        history: ctx.factsSource,
        synced:  ctx.synced,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
