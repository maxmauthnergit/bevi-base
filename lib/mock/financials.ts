import type { CashflowForecastMonth, LiquidPosition, Liability } from '../types'

// ─── Mock data for Financials / Cashflow page ─────────────────────────────────

export const mockLiquidPosition: LiquidPosition = {
  bank_balance: 22_250,
  paypal_balance: 6_200,
  weship_balance: 0,
  total: 28_450,
  as_of: '2026-03-30',
}

export const mockLiabilities: Liability[] = [
  {
    id: 'patent-cost',
    name: 'Patent Costs',
    amount: 9_500,
    due_date: null,
    note: 'Ongoing patent costs',
  },
  {
    id: 'shareholder-loan',
    name: 'Shareholder Loan',
    amount: 9_500,
    due_date: null,
    note: 'Repay when profitable',
  },
]

export const mockMonthlyPnL = [
  {
    month: 'Oct 25',
    revenue_gross: 7_200,
    revenue_net: 6_048,
    cogs: 2_184,
    cac: 2_500,
    weship: 591,
    fixed: 681,
    result: 92,
  },
  {
    month: 'Nov 25',
    revenue_gross: 9_840,
    revenue_net: 8_266,
    cogs: 2_976,
    cac: 3_240,
    weship: 806,
    fixed: 681,
    result: 563,
  },
  {
    month: 'Dec 25',
    revenue_gross: 14_100,
    revenue_net: 11_844,
    cogs: 4_272,
    cac: 4_600,
    weship: 1_157,
    fixed: 681,
    result: 1_134,
  },
  {
    month: 'Jan 26',
    revenue_gross: 8_620,
    revenue_net: 7_241,
    cogs: 2_616,
    cac: 2_680,
    weship: 709,
    fixed: 681,
    result: 555,
  },
  {
    month: 'Feb 26',
    revenue_gross: 10_440,
    revenue_net: 8_770,
    cogs: 3_168,
    cac: 3_290,
    weship: 858,
    fixed: 681,
    result: 773,
  },
  {
    month: 'Mar 26',
    revenue_gross: 14_820,
    revenue_net: 12_449,
    cogs: 4_464,
    cac: 3_710,
    weship: 1_209,
    fixed: 681,
    result: 2_385,
  },
]

export const mockCashflowForecast: CashflowForecastMonth[] = [
  {
    month: '2026-04',
    projected_revenue: 15_800,
    projected_ad_spend: 3_600,
    projected_weship_cost: 1_280,
    projected_fixed_costs: 681,
    projected_cogs: 4_560,
    projected_result: 2_649,
    is_forecast: true,
  },
  {
    month: '2026-05',
    projected_revenue: 17_200,
    projected_ad_spend: 3_900,
    projected_weship_cost: 1_390,
    projected_fixed_costs: 681,
    projected_cogs: 4_896,
    projected_result: 2_983,
    is_forecast: true,
  },
  {
    month: '2026-06',
    projected_revenue: 18_500,
    projected_ad_spend: 4_100,
    projected_weship_cost: 1_480,
    projected_fixed_costs: 681,
    projected_cogs: 5_280,
    projected_result: 3_309,
    is_forecast: true,
  },
]
