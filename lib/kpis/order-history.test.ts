import { describe, expect, it } from 'vitest'
import { firstOrderIds, restockedQuantities } from './order-history'
import { customerKey } from './order-facts'

const o = (id: number, email: string | null, customer: number | null, revenue_order = true) => ({
  id, revenue_order, customer_key: customerKey({ email: email as string, customer: customer ? { id: customer } : null }),
})

describe('firstOrderIds', () => {
  it('recognises returning customers by email (hashed), else by customer id', () => {
    const ids = firstOrderIds([
      o(1, 'anna@x.com', 11),
      o(2, 'guest@x.com', null),
      o(3, 'anna@x.com', 11),              // repeat customer
      o(4, ' GUEST@x.com ', 22),           // the same guest, now with an account
      o(5, 'bob@x.com', 33, false),        // cancelled: does not count
      o(6, 'bob@x.com', 33),               // so this is Bob's first
      o(7, null, 44),                      // no email → customer id
      o(8, null, 44),                      // repeat by customer id
      o(9, null, null),                    // nothing to match on → first
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 6, 7, 9])
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
