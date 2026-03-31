import type { KpiValue, DailySnapshot } from '../types'

// ─── Mock KPI values for dashboard home ──────────────────────────────────────

export const mockKpiValues: Record<string, KpiValue> = {
  revenue_mtd: {
    metricId: 'revenue_mtd',
    value: 14_820,
    previousValue: 11_340,
    delta: 3_480,
    deltaPercent: 30.7,
    trend: 'up',
    isPositiveUp: true,
  },
  units_mtd: {
    metricId: 'units_mtd',
    value: 186,
    previousValue: 142,
    delta: 44,
    deltaPercent: 31.0,
    trend: 'up',
    isPositiveUp: true,
  },
  ad_spend_mtd: {
    metricId: 'ad_spend_mtd',
    value: 3_210,
    previousValue: 2_890,
    delta: 320,
    deltaPercent: 11.1,
    trend: 'up',
    isPositiveUp: false,
  },
  roas_mtd: {
    metricId: 'roas_mtd',
    value: 4.62,
    previousValue: 3.92,
    delta: 0.7,
    deltaPercent: 17.9,
    trend: 'up',
    isPositiveUp: true,
  },
  contribution_margin_mtd: {
    metricId: 'contribution_margin_mtd',
    value: 5_940,
    previousValue: 4_120,
    delta: 1_820,
    deltaPercent: 44.2,
    trend: 'up',
    isPositiveUp: true,
  },
  liquid_position: {
    metricId: 'liquid_position',
    value: 28_450,
    previousValue: 24_800,
    delta: 3_650,
    deltaPercent: 14.7,
    trend: 'up',
    isPositiveUp: true,
  },
}

// ─── Last 30 days trend data ──────────────────────────────────────────────────

function generateLast30Days(): DailySnapshot[] {
  const data: DailySnapshot[] = []
  const today = new Date('2026-03-30')

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // Weekday multiplier (lower on Sundays)
    const dayOfWeek = date.getDay()
    const weekdayMult = dayOfWeek === 0 ? 0.6 : dayOfWeek === 6 ? 0.8 : 1

    // Slight upward trend over the period
    const trendMult = 1 + (29 - i) * 0.005

    // Revenue: base ~520/day with variance
    const baseRevenue = 520 * weekdayMult * trendMult
    const revVariance = baseRevenue * (0.7 + Math.random() * 0.6)
    const revenue = Math.round(revVariance)

    // Orders: ~6/day
    const orders = Math.round(revenue / 80)

    // Ad spend: ~110/day
    const spend = Math.round(110 * weekdayMult * (0.8 + Math.random() * 0.4))

    data.push({
      date: dateStr,
      shopify_revenue_gross: revenue,
      shopify_revenue_net: Math.round(revenue * 0.84),
      shopify_orders: orders,
      shopify_sessions: orders * 18,
      meta_spend: spend,
      meta_roas: revenue / spend,
      meta_cac: spend / Math.max(1, Math.round(orders * 0.7)),
      weship_costs: Math.round(orders * 6.5),
      paypal_balance: 6_200,
      bank_balance: 22_250,
    })
  }

  return data
}

export const mockTrendData = generateLast30Days()

// ─── Upcoming costs ───────────────────────────────────────────────────────────

export const mockUpcomingCosts = [
  { label: 'WeShip Invoice (Apr)', amount: 1_240, due: '2026-04-03' },
  { label: 'Meta Ads (est.)', amount: 3_400, due: '2026-04-01' },
  { label: 'Fixed Costs', amount: 681, due: '2026-04-01' },
]
