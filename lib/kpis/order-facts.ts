// ─── Order facts: the order history as a Supabase snapshot ───────────────────
// One slim row per Shopify order (supabase/order_facts.sql). Each request syncs
// only the orders changed since the last sync, then reads the snapshot. Facts
// only: FIFO and first-order detection run on them in memory, so a new inbound
// or a changed arrival date never leaves a stale cost behind.
//
// Until the table exists (SQL not run yet) or if Supabase fails, the facts are
// built from a live Shopify fetch instead — slower, same numbers.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { computeSalesSummary } from '@/lib/shopify/sales-summary'
import { isoInTZ } from '@/lib/comparison-period'
import { mapLineItem, type UnitDemand } from './product-mapping'
import { getOrderHistory, isRevenueOrder, restockedQuantities, type HistoryOrder } from './order-history'

export interface OrderFact {
  id:             number
  name:           string
  created_at:     string
  updated_at:     string
  day:            string          // YYYY-MM-DD in the shop timezone
  customer_key:   string | null
  revenue_order:  boolean
  units:          UnitDemand[]    // net of units that went back into stock
  unmapped_units: number
  lines:          { title: string; quantity: number }[]
  country:        string | null
  net_sales:      number          // excl. VAT
  shipping:       number          // excl. VAT
  amount_paid:    number          // total_price − successful refunds
}

export type FactsSource = 'snapshot' | 'live'

const TABLE      = 'order_facts'
const SYNC_KEY   = 'order_facts_sync'
const OVERLAP_MS = 10 * 60_000   // re-read the last 10 min: clock skew, in-flight writes

const num = (v: string | number | null | undefined) =>
  typeof v === 'number' ? v : parseFloat(v ?? '') || 0
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Who placed the order. The email links a guest checkout to the same person's
 * later account orders, so it comes first — stored only as a hash. Without an
 * email, the Shopify customer id.
 */
export function customerKey(o: Pick<HistoryOrder, 'email' | 'customer'>): string | null {
  const email = o.email?.trim().toLowerCase()
  if (email) return `e:${createHash('sha256').update(email).digest('hex')}`
  if (o.customer?.id) return `c:${o.customer.id}`
  return null
}

export function toFact(o: HistoryOrder, tz: string): OrderFact {
  const back = restockedQuantities(o)
  const units = new Map<string, number>()
  let unmapped = 0
  for (const li of o.line_items) {
    const qty = li.quantity - (back.get(li.id) ?? 0)
    if (qty <= 0) continue
    const parts = mapLineItem({ ...li, quantity: qty })
    if (!parts) { unmapped += qty; continue }
    for (const p of parts) units.set(p.productId, (units.get(p.productId) ?? 0) + p.quantity)
  }

  const refunded = (o.refunds ?? [])
    .flatMap(r => r.transactions ?? [])
    .filter(t => t.kind === 'refund' && t.status === 'success')
    .reduce((s, t) => s + num(t.amount), 0)
  const summary = computeSalesSummary([o])

  return {
    id:             o.id,
    name:           o.name,
    created_at:     o.created_at,
    updated_at:     o.updated_at ?? o.created_at,
    day:            isoInTZ(new Date(o.created_at), tz),
    customer_key:   customerKey(o),
    revenue_order:  isRevenueOrder(o),
    units:          [...units].map(([productId, quantity]) => ({ productId, quantity })),
    unmapped_units: unmapped,
    lines:          o.line_items.map(li => ({ title: li.title, quantity: li.quantity })),
    country:        o.shipping_address?.country_code ?? o.billing_address?.country_code ?? null,
    net_sales:      summary.net_sales,
    shipping:       summary.shipping,
    amount_paid:    r2(num(o.total_price) - refunded),
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

/** Fetches orders changed since the last sync (all of them with `full`), upserts them. */
export async function syncOrderFacts(db: SupabaseClient, tz: string, opts: { full?: boolean } = {}): Promise<number> {
  const startedAt = new Date()

  // Fail fast while the table does not exist yet, before fetching from Shopify
  const probe = await db.from(TABLE).select('id', { head: true, count: 'exact' }).limit(1)
  if (probe.error) throw new Error(probe.error.message)

  let since: string | undefined
  if (!opts.full) {
    const { data, error } = await db.from('app_config').select('value').eq('key', SYNC_KEY).maybeSingle()
    if (error) throw new Error(error.message)
    const last = (data?.value as { last_synced_at?: string } | null)?.last_synced_at
    if (last) since = new Date(Date.parse(last) - OVERLAP_MS).toISOString()
  }

  const orders = await getOrderHistory(since)
  const facts  = orders.map(o => toFact(o, tz))
  for (let i = 0; i < facts.length; i += 500) {
    const chunk = facts.slice(i, i + 500).map(f => ({ ...f, synced_at: startedAt.toISOString() }))
    const { error } = await db.from(TABLE).upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }

  const { error } = await db.from('app_config').upsert(
    { key: SYNC_KEY, value: { last_synced_at: startedAt.toISOString() }, updated_at: startedAt.toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw new Error(error.message)
  return facts.length
}

async function readAllFacts(db: SupabaseClient): Promise<OrderFact[]> {
  const out: OrderFact[] = []
  const PAGE = 1000   // Supabase returns at most 1000 rows per request
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(TABLE)
      .select('id, name, created_at, updated_at, day, customer_key, revenue_order, units, unmapped_units, lines, country, net_sales, shipping, amount_paid')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      out.push({
        ...(r as OrderFact),
        id:          Number(r.id),
        net_sales:   num(r.net_sales),
        shipping:    num(r.shipping),
        amount_paid: num(r.amount_paid),
      })
    }
    if (!data || data.length < PAGE) break
  }
  return out
}

export interface LoadedFacts {
  facts:   OrderFact[]          // chronological
  source:  FactsSource
  synced:  number               // orders refreshed by this request's sync
  error?:  string               // why the snapshot was not used
}

export async function loadOrderFacts(tz: string): Promise<LoadedFacts> {
  try {
    const db     = createServerClient()
    const synced = await syncOrderFacts(db, tz)
    return { facts: await readAllFacts(db), source: 'snapshot', synced }
  } catch (err) {
    const error = (err as Error).message
    console.warn('[order-facts] snapshot unavailable, using live history:', error)
    const history = await getOrderHistory()
    return { facts: history.map(o => toFact(o, tz)), source: 'live', synced: 0, error }
  }
}
