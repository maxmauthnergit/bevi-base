// ─── Every order since the shop opened ───────────────────────────────────────
// FIFO needs every unit ever sold to know which lot a sale draws from, and
// first-order detection needs every earlier order of a customer — so both work
// on the full history, fetched once and cached for an hour.

import { shopifyFetchAllOrders, type ShopifyOrder } from '@/lib/shopify/client'
import type { SalesOrder } from '@/lib/shopify/sales-summary'

export const SHOP_START = '2024-11-01'

export type HistoryOrder = ShopifyOrder & SalesOrder & {
  customer?: { id: number } | null
  line_items: (ShopifyOrder['line_items'][number] & SalesOrder['line_items'][number])[]
  refunds: (ShopifyOrder['refunds'][number] & {
    refund_line_items: { quantity: number; line_item_id: number; restock_type?: string; subtotal: number | string; total_tax: number | string }[]
    order_adjustments?: { kind: string; amount: string; tax_amount: string }[]
  })[]
}

const FIELDS = [
  'id', 'name', 'created_at', 'email', 'customer', 'financial_status', 'cancelled_at',
  'taxes_included', 'total_price', 'line_items', 'shipping_lines', 'refunds',
  'shipping_address', 'billing_address',
  'current_total_duties_set', 'current_total_additional_fees_set',
].join(',')

export async function getOrderHistory(): Promise<HistoryOrder[]> {
  const params = new URLSearchParams({
    status:         'any',
    created_at_min: new Date(`${SHOP_START}T00:00:00Z`).toISOString(),
    limit:          '250',
    fields:         FIELDS,
  })
  const orders = await shopifyFetchAllOrders(params, { revalidate: 3600 }) as unknown as HistoryOrder[]
  return orders.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Orders that carry revenue: not voided, not cancelled. */
export function isRevenueOrder(o: Pick<ShopifyOrder, 'financial_status' | 'cancelled_at'>): boolean {
  return o.financial_status !== 'voided' && !o.cancelled_at
}

/**
 * Ids of orders that were their customer's first. A customer is the Shopify
 * customer id, or for guest checkouts the trimmed, lower-cased email. Orders
 * with neither count as first orders — there is nothing to match them on.
 * Expects the full history in chronological order.
 */
export function firstOrderIds(
  history: Pick<HistoryOrder, 'id' | 'email' | 'customer' | 'financial_status' | 'cancelled_at'>[],
): Set<number> {
  const seen  = new Set<string>()
  const first = new Set<number>()
  for (const o of history) {
    if (!isRevenueOrder(o)) continue
    const email = o.email?.trim().toLowerCase()
    const keys  = [o.customer?.id ? `c:${o.customer.id}` : null, email ? `e:${email}` : null]
      .filter((k): k is string => k !== null)
    if (keys.length === 0 || !keys.some(k => seen.has(k))) first.add(o.id)
    for (const k of keys) seen.add(k)
  }
  return first
}

/**
 * Units of each line item that went back into stock. A refund without restock
 * (damaged, kept by the customer) still used the goods up, so it keeps its COGS.
 */
export function restockedQuantities(o: Pick<HistoryOrder, 'refunds'>): Map<number, number> {
  const back = new Map<number, number>()
  for (const r of o.refunds ?? []) {
    for (const rli of r.refund_line_items ?? []) {
      if (rli.restock_type === 'no_restock') continue
      back.set(rli.line_item_id, (back.get(rli.line_item_id) ?? 0) + rli.quantity)
    }
  }
  return back
}
