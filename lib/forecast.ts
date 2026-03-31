import type { CashflowForecastMonth, LiquidPosition, Liability } from './types'

// ─── Constants (update when actuals change) ───────────────────────────────────

export const COGS_PER_UNIT = 24          // €24 per unit (includes fulfillment to customer)
export const FIXED_COSTS_MONTHLY = 681   // €681/month current fixed costs
export const FOUNDER_SALARY_ANNUAL = 0   // €0 now; €21k/year each from Year 1

// ─── Forecast computation ─────────────────────────────────────────────────────

export interface ForecastInput {
  month: string
  projected_revenue_gross: number
  projected_revenue_net: number
  projected_units: number
  projected_ad_spend: number
  projected_new_customers: number
  projected_weship_cost: number
  fixed_costs?: number
  founder_salary?: number
}

export function computeForecastMonth(input: ForecastInput): CashflowForecastMonth {
  const fixed = input.fixed_costs ?? FIXED_COSTS_MONTHLY
  const salary = input.founder_salary ?? FOUNDER_SALARY_ANNUAL / 12

  const projected_cogs = input.projected_units * COGS_PER_UNIT
  const projected_cac = input.projected_ad_spend  // simplified: spend = CAC total
  const projected_result =
    input.projected_revenue_net -
    projected_cogs -
    projected_cac -
    input.projected_weship_cost -
    fixed -
    salary

  return {
    month: input.month,
    projected_revenue: input.projected_revenue_gross,
    projected_ad_spend: input.projected_ad_spend,
    projected_weship_cost: input.projected_weship_cost,
    projected_fixed_costs: fixed + salary,
    projected_cogs,
    projected_result,
    is_forecast: true,
  }
}

// ─── Liquid position rolling forecast ────────────────────────────────────────

export function computeLiquidForecast(
  current: LiquidPosition,
  months: CashflowForecastMonth[],
  liabilities: Liability[],
): { month: string; position: number }[] {
  let running = current.total

  // Subtract known upcoming liabilities
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0)
  running -= totalLiabilities

  return months.map((m) => {
    running += m.projected_result
    return { month: m.month, position: running }
  })
}

// ─── Month label helper ───────────────────────────────────────────────────────

export function formatMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}
