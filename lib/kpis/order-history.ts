// ─── Shopify orders for the order-facts snapshot ─────────────────────────────
// FIFO needs every unit ever sold to know which lot a sale draws from, and
// first-order detection needs every earlier order of a customer. The snapshot
// (./order-facts) keeps that history in Supabase; this fetches the orders that
// feed it — all of them on the first sync, then only the ones changed since.

import { shopifyFetchAllOrders, type ShopifyOrder } from '@/lib/shopify/client'
import type { SalesOrder } from '@/lib/shopify/sales-summary'

export const SHOP_START = '2024-11-01'

export type HistoryOrder = ShopifyOrder & SalesOrder & {
  updated_at: string
  customer?: { id: number } | null
  line_items: (ShopifyOrder['line_items'][number] & SalesOrder['line_items'][number])[]
  refunds: (ShopifyOrder['refunds'][number] & {
    refund_line_items: { quantity: number; line_item_id: number; restock_type?: string; subtotal: number | string; total_tax: number | string }[]
    order_adjustments?: { kind: string; amount: string; tax_amount: string }[]
  })[]
}

const FIELDS = [
  'id', 'name', 'created_at', 'updated_at', 'email', 'customer', 'financial_status', 'cancelled_at',
  'taxes_included', 'total_price', 'line_items', 'shipping_lines', 'refunds',
  'shipping_address', 'billing_address',
  'current_total_duties_set', 'current_total_additional_fees_set',
].join(',')

/**
 * Every order since SHOP_START, or with `updatedSince` only the orders created
 * or changed (refunded, cancelled, edited) after that instant. Never cached:
 * the snapshot is the cache.
 */
export async function getOrderHistory(updatedSince?: string): Promise<HistoryOrder[]> {
  const params = new URLSearchParams({
    status:         'any',
    created_at_min: new Date(`${SHOP_START}T00:00:00Z`).toISOString(),
    limit:          '250',
    fields:         FIELDS,
  })
  if (updatedSince) params.set('updated_at_min', updatedSince)
  const orders = await shopifyFetchAllOrders(params, { revalidate: 0 }) as unknown as HistoryOrder[]
  return orders.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Orders that carry revenue: not voided, not cancelled. */
export function isRevenueOrder(o: Pick<ShopifyOrder, 'financial_status' | 'cancelled_at'>): boolean {
  return o.financial_status !== 'voided' && !o.cancelled_at
}

/**
 * Ids of orders that were their customer's first. Orders without a customer
 * key count as first orders — there is nothing to match them on. Expects the
 * full history in chronological order.
 */
export function firstOrderIds(
  history: { id: number; customer_key: string | null; revenue_order: boolean }[],
): Set<number> {
  const seen  = new Set<string>()
  const first = new Set<number>()
  for (const o of history) {
    if (!o.revenue_order) continue
    if (!o.customer_key || !seen.has(o.customer_key)) first.add(o.id)
    if (o.customer_key) seen.add(o.customer_key)
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
