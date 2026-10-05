import { describe, expect, it } from 'vitest'
import { firstOrderIds, restockedQuantities } from './order-history'

const o = (id: number, email: string | null, customer: number | null, extra: { cancelled_at?: string | null } = {}) => ({
  id, email: email as string, customer: customer ? { id: customer } : null,
  financial_status: 'paid', cancelled_at: extra.cancelled_at ?? null,
})

describe('firstOrderIds', () => {
  it('detects first orders by customer id, then by normalised email', () => {
    const ids = firstOrderIds([
      o(1, 'anna@x.com', 11),
      o(2, 'guest@x.com', null),
      o(3, 'anna@x.com', 11),              // repeat customer
      o(4, ' GUEST@x.com ', 22),           // same guest email, now with an account
      o(5, 'bob@x.com', 33, { cancelled_at: '2025-01-01' }),   // cancelled: does not count
      o(6, 'bob@x.com', 33),               // so this is Bob's first
      o(7, null, null),                    // nothing to match on → first
    ])
    expect([...ids].sort()).toEqual([1, 2, 6, 7])
  })
})

describe('restockedQuantities', () => {
  it('counts units that went back into stock, not refunds without restock', () => {
    const back = restockedQuantities({
      refunds: [{
        id: 1, created_at: '', transactions: [],
        refund_line_items: [
          { line_item_id: 100, quantity: 1, restock_type: 'return',     subtotal: 0, total_tax: 0 },
          { line_item_id: 100, quantity: 1, restock_type: 'cancel',     subtotal: 0, total_tax: 0 },
          { line_item_id: 200, quantity: 2, restock_type: 'no_restock', subtotal: 0, total_tax: 0 },
        ],
      }],
    })
    expect(back.get(100)).toBe(2)
    expect(back.has(200)).toBe(false)
  })
})
