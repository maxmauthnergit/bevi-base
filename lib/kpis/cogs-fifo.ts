// ─── COGS by FIFO from inbound lots ──────────────────────────────────────────
// Every shipment leg that has reached WeShip (actual_arrival set) becomes one
// lot per product it carries. Sales draw from the oldest lot that had already
// arrived on the sale day; once a lot is empty the next one takes over. Sales
// with no lot to draw from (before the first recorded inbound, or after all
// recorded stock is used up) fall back to the configured per-unit cost and are
// flagged as estimated — that is a gap in the inbound data, not a real cost.
//
// Pure: no data access, so it can be tested with hand-made lots and sales.

import type { Inbound } from '@/lib/inbounds'

export interface Lot {
  productId:  string
  arrival:    string   // YYYY-MM-DD, WeShip arrival
  quantity:   number
  unitCost:   number   // production + freight per unit, EUR
  production: number   // per unit
  freight:    number   // per unit
  inbound:    string   // inbound name, for tracing
}

/**
 * Production cost per unit comes from the charge's position (total / produced
 * quantity); freight per unit from the shipment leg (its cost spread over every
 * unit it carries — the quantity split perProductSummary uses too).
 */
export function buildLots(inbounds: Pick<Inbound, 'name' | 'items' | 'shipments'>[]): Lot[] {
  const lots: Lot[] = []
  for (const inb of inbounds) {
    for (const sh of inb.shipments) {
      if (!sh.actual_arrival) continue
      const qtyOnShipment = sh.items.reduce((s, si) => s + si.quantity, 0)
      if (qtyOnShipment <= 0) continue
      const freight = sh.cost_eur / qtyOnShipment
      for (const si of sh.items) {
        if (si.quantity <= 0) continue
        const pos = inb.items.find(it => it.product_id === si.product_id)
        const production = pos && pos.quantity > 0 ? pos.production_cost_eur / pos.quantity : 0
        lots.push({
          productId:  si.product_id,
          arrival:    sh.actual_arrival,
          quantity:   si.quantity,
          unitCost:   production + freight,
          production,
          freight,
          inbound:    inb.name,
        })
      }
    }
  }
  return lots.sort((a, b) => a.arrival.localeCompare(b.arrival))
}

export interface Sale {
  orderId:   string | number
  day:       string   // YYYY-MM-DD in the shop timezone
  productId: string
  quantity:  number   // net of units that came back into stock
}

export interface OrderCogs {
  cogs:           number
  estimatedCogs:  number   // part of cogs priced by the fallback rate
  units:          number
  estimatedUnits: number
}

export interface FifoResult {
  byOrder:   Map<string | number, OrderCogs>
  remaining: { lot: Lot; left: number }[]   // stock left per lot after all sales
}

export function runFifo(
  sales: Sale[],
  lots: Lot[],
  fallbackUnitCost: (productId: string) => number,
): FifoResult {
  const left = lots.map(l => l.quantity)
  const byProduct = new Map<string, number[]>()   // productId → lot indexes, oldest first
  lots.forEach((l, i) => {
    const list = byProduct.get(l.productId) ?? []
    list.push(i)
    byProduct.set(l.productId, list)
  })

  const byOrder = new Map<string | number, OrderCogs>()
  const ordered = [...sales].sort((a, b) => a.day.localeCompare(b.day))

  for (const sale of ordered) {
    const acc = byOrder.get(sale.orderId) ?? { cogs: 0, estimatedCogs: 0, units: 0, estimatedUnits: 0 }
    let need = Math.max(0, sale.quantity)
    acc.units += need

    for (const i of byProduct.get(sale.productId) ?? []) {
      if (need <= 0) break
      if (lots[i].arrival > sale.day) break   // sorted: later lots have not arrived either
      const take = Math.min(need, left[i])
      if (take <= 0) continue
      left[i]  -= take
      need     -= take
      acc.cogs += take * lots[i].unitCost
    }

    if (need > 0) {
      const est = need * fallbackUnitCost(sale.productId)
      acc.cogs           += est
      acc.estimatedCogs  += est
      acc.estimatedUnits += need
    }
    byOrder.set(sale.orderId, acc)
  }

  return { byOrder, remaining: lots.map((lot, i) => ({ lot, left: left[i] })) }
}
