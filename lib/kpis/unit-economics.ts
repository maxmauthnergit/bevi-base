// ─── Marketing 2.0: gather a period's inputs and apply the formulas ──────────
// Data access lives here; every formula lives in ./formulas, COGS in ./cogs-fifo.

import { createServerClient } from '@/lib/supabase'
import { getShopTimezone } from '@/lib/shopify/queries'
import { computeSalesSummary, getSalesSummary, type SalesSummarySource } from '@/lib/shopify/sales-summary'
import { getMetaInsightsForRange } from '@/lib/meta/queries'
import { fetchInbounds } from '@/lib/inbounds-db'
import { INBOUND_PRODUCTS } from '@/lib/inbounds'
import { DEFAULT_PRODUCT_COSTS } from '@/lib/costs-config'
import { getCosts, loadAmountsMap, loadWeShipCosts, type AmountsMap } from '@/lib/order-costs'
import { isoInTZ, type PeriodBounds } from '@/lib/comparison-period'
import { buildLots, runFifo, type FifoResult, type Sale } from './cogs-fifo'
import { mapLineItem } from './product-mapping'
import {
  getOrderHistory, firstOrderIds, isRevenueOrder, restockedQuantities, type HistoryOrder,
} from './order-history'
import {
  computeUnitEconomics, costOfDelivery, estimatePaymentFee, monthShareInRange,
  type PeriodInputs, type UnitEconomics,
} from './formulas'

// ─── Shared context (built once per request, used for both periods) ──────────

export interface UnitEconomicsContext {
  tz:         string
  history:    HistoryOrder[]
  firstIds:   Set<number>
  fifo:       FifoResult
  amountsMap: AmountsMap
  lotCount:   number
  unmappedUnits: number   // sold units no inbound product could be found for
}

const num = (v: string | number | null | undefined) =>
  typeof v === 'number' ? v : parseFloat(v ?? '') || 0

/** Configured production + IB cost of an inbound product (FIFO fallback). */
function configuredUnitCost(productId: string, amountsMap: AmountsMap): number {
  const costKey  = INBOUND_PRODUCTS.find(p => p.id === productId)?.costKey
  const titleKey = DEFAULT_PRODUCT_COSTS.find(p => p.id === costKey)?.titleKey
  const a = titleKey ? amountsMap.get(titleKey) : undefined
  return a ? a.manufacturing + a.ib_shipping : 0
}

export async function loadUnitEconomicsContext(): Promise<UnitEconomicsContext> {
  const [tz, history, inbounds, amountsMap] = await Promise.all([
    getShopTimezone(),
    getOrderHistory(),
    fetchInbounds(createServerClient()),
    loadAmountsMap(),
  ])

  // Every unit ever sold, net of units that came back into stock
  const sales: Sale[] = []
  let unmappedUnits = 0
  for (const o of history) {
    if (!isRevenueOrder(o)) continue
    const back = restockedQuantities(o)
    const day  = isoInTZ(new Date(o.created_at), tz)
    for (const li of o.line_items) {
      const qty = li.quantity - (back.get(li.id) ?? 0)
      if (qty <= 0) continue
      const parts = mapLineItem({ ...li, quantity: qty })
      if (!parts) { unmappedUnits += qty; continue }
      for (const p of parts) sales.push({ orderId: o.id, day, productId: p.productId, quantity: p.quantity })
    }
  }

  const lots = buildLots(inbounds)
  return {
    tz,
    history,
    firstIds: firstOrderIds(history),
    fifo:     runFifo(sales, lots, id => configuredUnitCost(id, amountsMap)),
    amountsMap,
    lotCount: lots.length,
    unmappedUnits,
  }
}

// ─── One period ──────────────────────────────────────────────────────────────

export interface PeriodResult {
  inputs:  PeriodInputs
  metrics: UnitEconomics
  storage: number                  // part of fulfillment
  shippingCosts: number            // part of fulfillment (outbound delivery)
  estimated: {
    cogs:        number            // EUR priced by the fallback rate
    fulfillment: number            // EUR not from an actual WeShip invoice
    fees:        number            // EUR (all estimated for now)
  }
  firstOrders:   number
  revenueSource: SalesSummarySource
  metaOk:        boolean
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const [ey, em] = to.slice(0, 7).split('-').map(Number)
  while (y * 12 + m <= ey * 12 + em) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
  }
  return out
}

export async function computePeriod(ctx: UnitEconomicsContext, bounds: PeriodBounds): Promise<PeriodResult> {
  const { tz } = ctx
  const from = isoInTZ(bounds.fromDate, tz)
  const to   = isoInTZ(bounds.toDate,   tz)
  const t0 = bounds.fromDate.getTime(), t1 = bounds.toDate.getTime()

  const inRange = ctx.history.filter(o => {
    const t = Date.parse(o.created_at)
    return t >= t0 && t <= t1 && isRevenueOrder(o)
  })
  const ordersForMonth = async (m: string) =>
    ctx.history.filter(o => isoInTZ(new Date(o.created_at), tz).startsWith(m))

  const months = monthsBetween(from, to)
  const [summaryRes, metaRes, weship] = await Promise.all([
    getSalesSummary(from, to),
    getMetaInsightsForRange(bounds.fromDate, bounds.toDate, tz).then(m => ({ ok: true as const, m })).catch(() => ({ ok: false as const })),
    loadWeShipCosts(months, ordersForMonth),
  ])

  // Per-order costs
  let cogs = 0, estCogs = 0, fulfillment = 0, shippingCosts = 0, estFulfillment = 0, returnCosts = 0, fees = 0
  const firstOrders: HistoryOrder[] = []
  let firstCod = 0

  for (const o of inRange) {
    const c = ctx.fifo.byOrder.get(o.id)
    const orderCogs = c?.cogs ?? 0
    cogs    += orderCogs
    estCogs += c?.estimatedCogs ?? 0

    const w = weship.forOrder(o)
    let weshipCost   = w.weship
    let shippingCost = w.shipping
    // Nothing on file at all: use the fixed per-unit rates rather than 0
    if (w.weship_source === 'estimated' || w.shipping_source === 'estimated') {
      const perUnit = o.line_items.reduce((acc, li) => {
        const p = getCosts(li.title, ctx.amountsMap)
        return { weship: acc.weship + p.weship * li.quantity, shipping: acc.shipping + p.shipping * li.quantity }
      }, { weship: 0, shipping: 0 })
      if (w.weship_source   === 'estimated') weshipCost   = perUnit.weship
      if (w.shipping_source === 'estimated') shippingCost = perUnit.shipping
    }
    const orderFulfillment = weshipCost + shippingCost
    fulfillment   += orderFulfillment
    shippingCosts += shippingCost
    if (w.weship_source   !== 'actual') estFulfillment += weshipCost
    if (w.shipping_source !== 'actual') estFulfillment += shippingCost
    returnCosts += w.returns

    const refunded = (o.refunds ?? [])
      .flatMap(r => r.transactions ?? [])
      .filter(t => t.kind === 'refund' && t.status === 'success')
      .reduce((s, t) => s + num(t.amount), 0)
    const fee = estimatePaymentFee(num(o.total_price) - refunded)
    fees += fee

    if (ctx.firstIds.has(o.id)) {
      firstOrders.push(o)
      firstCod += costOfDelivery({ cogs: orderCogs, fulfillment: orderFulfillment, returnCosts: w.returns, paymentFees: fee })
    }
  }

  // Monthly storage fee, pro rata for the days of each month in range
  const storage = months.reduce((s, m) => s + weship.storageFee(m) * monthShareInRange(m, from, to), 0)
  fulfillment += storage

  const first = computeSalesSummary(firstOrders)
  const { summary } = summaryRes
  const meta = metaRes.ok ? metaRes.m : null

  const inputs: PeriodInputs = {
    netSales:          summary.net_sales,
    shipping:          summary.shipping,
    orders:            summary.order_count,
    adSpend:           meta?.spend ?? 0,
    metaPurchaseValue: meta?.purchase_value ?? 0,
    cogs,
    fulfillment,
    returnCosts,
    paymentFees:       fees,
    newCustomers:      firstOrders.length,
    firstOrders: {
      netRevenue: first.net_sales + first.shipping,
      cod:        firstCod,
    },
  }

  return {
    inputs,
    metrics:       computeUnitEconomics(inputs),
    storage,
    shippingCosts,
    estimated:     { cogs: estCogs, fulfillment: estFulfillment, fees },
    firstOrders:   firstOrders.length,
    revenueSource: summaryRes.source,
    metaOk:        metaRes.ok,
  }
}
