import { describe, expect, it } from 'vitest'
import { computeUnitEconomics, estimatePaymentFee, monthShareInRange, type PeriodInputs } from './formulas'

const base: PeriodInputs = {
  netSales: 1000, shipping: 50, orders: 20, adSpend: 300, metaPurchaseValue: 900,
  cogs: 200, fulfillment: 150, returnCosts: 10, paymentFees: 40,
  newCustomers: 10, firstOrders: { netRevenue: 600, cod: 250 },
}

describe('computeUnitEconomics', () => {
  it('computes every KPI from period totals', () => {
    const m = computeUnitEconomics(base)
    expect(m.net_revenue).toBe(1050)            // 1000 + 50
    expect(m.aov).toBe(52.5)                    // 1050 / 20
    expect(m.meta_roas).toBe(3)                 // 900 / 300
    expect(m.mer).toBe(3.5)                     // 1050 / 300
    expect(m.ncac).toBe(30)                     // 300 / 10
    expect(m.cod).toBe(400)                     // 200 + 150 + 10 + 40
    expect(m.contribution).toBe(350)            // 1050 − 400 − 300
    expect(m.contribution_pct).toBeCloseTo(33.333, 3)
    expect(m.first_order_contribution).toBe(35) // (600 − 250) / 10
    expect(m.foc_to_ncac).toBeCloseTo(35 / 30, 6)
  })

  it('returns null instead of dividing by zero ad spend', () => {
    const m = computeUnitEconomics({ ...base, adSpend: 0 })
    expect(m.mer).toBeNull()
    expect(m.meta_roas).toBeNull()
    expect(m.ncac).toBe(0)                      // new customers at no ad cost
    expect(m.foc_to_ncac).toBeNull()            // … but no ratio against a 0 € nCAC
    expect(m.contribution).toBe(650)
  })

  it('handles a period without orders', () => {
    const m = computeUnitEconomics({
      ...base, netSales: 0, shipping: 0, orders: 0, cogs: 0, fulfillment: 0, returnCosts: 0, paymentFees: 0,
      newCustomers: 0, firstOrders: { netRevenue: 0, cod: 0 },
    })
    expect(m.aov).toBeNull()
    expect(m.contribution_pct).toBeNull()
    expect(m.ncac).toBeNull()
    expect(m.first_order_contribution).toBeNull()
    expect(m.contribution).toBe(-300)           // ad spend with nothing sold
  })
})

describe('helpers', () => {
  it('estimates the payment fee as 2 % + 0.25 €', () => {
    expect(estimatePaymentFee(100)).toBeCloseTo(2.25, 10)
    expect(estimatePaymentFee(-5)).toBe(0.25)   // fully refunded order still paid the fixed part
  })

  it('pro-rates a month by the days inside the range', () => {
    expect(monthShareInRange('2025-02', '2025-02-15', '2025-03-10')).toBe(0.5)  // 14 of 28 days
    expect(monthShareInRange('2025-03', '2025-02-15', '2025-03-10')).toBeCloseTo(10 / 31, 10)
    expect(monthShareInRange('2025-04', '2025-02-15', '2025-03-10')).toBe(0)
  })
})
