import { describe, expect, it } from 'vitest'
import { buildLots, runFifo, type Sale } from './cogs-fifo'
import type { Inbound } from '@/lib/inbounds'

type Inb = Pick<Inbound, 'name' | 'items' | 'shipments'>

const item = (product_id: string, quantity: number, production_cost_eur: number) => ({
  product_id, quantity, production_cost_eur, production_cost_usd: 0, charge: '', supplier_id: null,
})
const ship = (cost_eur: number, actual_arrival: string | null, items: { product_id: string; quantity: number }[]) => ({
  mode: 'air' as const, shipping_company_id: null, cost_usd: 0, cost_eur, fx_usd_eur: null, fx_date: null,
  planned_arrival: null, actual_arrival, items,
})

// Charge A: 100 bags at 10 €/unit production, split over two legs.
//   Leg 1: 40 bags, 200 € freight → 5 €/unit → lot cost 15, arrives 10 Jan
//   Leg 2: 60 bags, 120 € freight → 2 €/unit → lot cost 12, arrives  1 Feb
// Charge B: 50 bags at 12 €/unit, 100 € freight → 2 €/unit → lot cost 14, arrives 1 Mar
const inbounds: Inb[] = [
  {
    name: 'A',
    items: [item('bag', 100, 1000)],
    shipments: [ship(200, '2025-01-10', [{ product_id: 'bag', quantity: 40 }]),
                ship(120, '2025-02-01', [{ product_id: 'bag', quantity: 60 }])],
  },
  {
    name: 'B',
    items: [item('bag', 50, 600)],
    shipments: [ship(100, '2025-03-01', [{ product_id: 'bag', quantity: 50 }]),
                ship(999, null,         [{ product_id: 'bag', quantity: 10 }])],   // not arrived → no lot
  },
]

describe('buildLots', () => {
  it('makes one lot per arrived leg with production + freight per unit', () => {
    const lots = buildLots(inbounds)
    expect(lots.map(l => [l.arrival, l.quantity, l.unitCost])).toEqual([
      ['2025-01-10', 40, 15],
      ['2025-02-01', 60, 12],
      ['2025-03-01', 50, 14],
    ])
  })

  it('splits a leg carrying several products by quantity', () => {
    const lots = buildLots([{
      name: 'mixed',
      items: [item('bag', 10, 100), item('strap', 30, 30)],
      shipments: [ship(80, '2025-01-01', [{ product_id: 'bag', quantity: 10 }, { product_id: 'strap', quantity: 30 }])],
    }])
    // freight 80 / 40 units = 2 €/unit for both products
    expect(lots.map(l => [l.productId, l.unitCost])).toEqual([['bag', 12], ['strap', 3]])
  })
})

describe('runFifo', () => {
  const fallback = () => 13
  const sale = (orderId: string, day: string, quantity: number): Sale => ({ orderId, day, productId: 'bag', quantity })

  const { byOrder, remaining } = runFifo([
    sale('o1', '2025-01-05',  2),   // before any lot arrived → fallback 2 × 13 = 26
    sale('o2', '2025-01-20', 30),   // 30 × 15 = 450
    sale('o3', '2025-02-15', 20),   // old lot first: 10 × 15 + 10 × 12 = 270
    sale('o4', '2025-03-05', 55),   // 50 × 12 + 5 × 14 = 670
    sale('o5', '2025-03-06', 50),   // 45 × 14 + 5 × 13 (stock used up) = 695
  ], buildLots(inbounds), fallback)

  it('prices sales before the first arrival with the fallback, flagged as estimated', () => {
    expect(byOrder.get('o1')).toEqual({ cogs: 26, estimatedCogs: 26, units: 2, estimatedUnits: 2 })
  })

  it('draws from the oldest arrived lot', () => {
    expect(byOrder.get('o2')?.cogs).toBe(450)
  })

  it('finishes the old lot before using a newer one that has arrived', () => {
    expect(byOrder.get('o3')?.cogs).toBe(270)
    expect(byOrder.get('o4')?.cogs).toBe(670)
  })

  it('falls back once all recorded stock is used up', () => {
    expect(byOrder.get('o5')).toEqual({ cogs: 695, estimatedCogs: 65, units: 50, estimatedUnits: 5 })
    expect(remaining.every(r => r.left === 0)).toBe(true)
  })

  it('ignores non-positive quantities', () => {
    const r = runFifo([sale('x', '2025-03-02', 0), sale('y', '2025-03-02', -3)], buildLots(inbounds), fallback)
    expect(r.byOrder.get('x')?.cogs).toBe(0)
    expect(r.byOrder.get('y')?.cogs).toBe(0)
  })
})
