import { describe, expect, it } from 'vitest'
import { customerKey, toFact } from './order-facts'
import type { HistoryOrder } from './order-history'

const li = (id: number, title: string, quantity: number, price: string, variant_title: string | null = null) => ({
  id, title, quantity, price, variant_title, sku: '', product_id: 0, variant_id: 0,
  tax_lines: [{ price: (parseFloat(price) * quantity * 0.19 / 1.19).toFixed(2), rate: 0.19 }],
  discount_allocations: [],
})

function order(over: Partial<HistoryOrder> = {}): HistoryOrder {
  return {
    id: 1, name: '#1001', created_at: '2025-03-31T23:30:00Z', updated_at: '2025-04-02T10:00:00Z',
    email: 'Anna@Example.com ', customer: { id: 7 },
    financial_status: 'paid', fulfillment_status: null, cancelled_at: null, cancel_reason: null,
    taxes_included: true, currency: 'EUR', total_price: '124.94', subtotal_price: '119.00',
    total_tax: '19.95', total_discounts: '0.00', discount_codes: [],
    line_items: [li(10, 'Bevi Bundle S', 1, '119.00', 'Beige'), li(11, 'Gift Card', 1, '0.00')],
    shipping_lines: [{ price: '5.94', tax_lines: [{ price: '0.95', rate: 0.19 }] }],
    refunds: [],
    shipping_address: { country_code: 'AT' },
    ...over,
  } as HistoryOrder
}

describe('customerKey', () => {
  it('hashes the normalised email and never stores it in clear', () => {
    const a = customerKey({ email: ' Anna@Example.com', customer: null })
    expect(a).toBe(customerKey({ email: 'anna@example.com', customer: { id: 9 } }))
    expect(a).toMatch(/^e:[0-9a-f]{64}$/)
    expect(a).not.toContain('anna')
  })

  it('falls back to the customer id, then to nothing', () => {
    expect(customerKey({ email: '', customer: { id: 9 } })).toBe('c:9')
    expect(customerKey({ email: '', customer: null })).toBeNull()
  })
})

describe('toFact', () => {
  it('maps units, revenue and the shop-timezone day', () => {
    const f = toFact(order(), 'Europe/Vienna')
    expect(f.day).toBe('2025-04-01')            // 23:30 UTC on 31 Mar is 1 Apr in Vienna
    expect(f.revenue_order).toBe(true)
    expect(f.units).toEqual([
      { productId: 'bevi-bag-beige', quantity: 1 },
      { productId: 'phone-strap',    quantity: 1 },
    ])
    expect(f.unmapped_units).toBe(1)            // the gift card
    expect(f.net_sales).toBe(100)               // 119 incl. 19 % VAT
    expect(f.shipping).toBe(4.99)               // 5.94 − 0.95 VAT
    expect(f.amount_paid).toBe(124.94)
    expect(f.country).toBe('AT')
    expect(f.lines).toEqual([{ title: 'Bevi Bundle S', quantity: 1 }, { title: 'Gift Card', quantity: 1 }])
  })

  it('takes restocked returns out of the units and refunds out of the amount paid', () => {
    const f = toFact(order({
      refunds: [{
        id: 1, created_at: '', refund_line_items: [{ line_item_id: 10, quantity: 1, restock_type: 'return', subtotal: 119, total_tax: 19 }],
        transactions: [{ id: 1, amount: '119.00', kind: 'refund', status: 'success' }],
      }],
    } as Partial<HistoryOrder>), 'Europe/Vienna')
    expect(f.units).toEqual([])
    expect(f.amount_paid).toBe(5.94)
    expect(f.net_sales).toBe(0)                 // 100 gross − 100 returns
  })

  it('marks cancelled orders as carrying no revenue', () => {
    expect(toFact(order({ cancelled_at: '2025-04-01T00:00:00Z' }), 'UTC').revenue_order).toBe(false)
  })
})
