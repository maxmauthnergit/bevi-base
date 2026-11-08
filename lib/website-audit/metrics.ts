// ─── Website audit: live Shopify metrics (read-only) ─────────────────────────
// Everything here only READS from Shopify. Each block is fetched on its own and
// reports its own status, so one refused query never hides the others, and a
// metric the API does not deliver is shown as unavailable — never estimated.

import { shopifyGraphQL } from '@/lib/shopify/client'
import { getShopTimezone } from '@/lib/shopify/queries'
import { metaFetch, getAccountId } from '@/lib/meta/client'

const SHOPIFYQL_API_VERSION = '2025-10'

export type Status<T> =
  | { ok: true;  data: T; note?: string }
  | { ok: false; error: string }

export interface FunnelRow {
  device:            string
  sessions:          number
  addedToCart:       number
  reachedCheckout:   number
  completedCheckout: number
}

export interface RankedRow { label: string; sessions: number; conversions: number | null }

export interface OrderMetrics {
  orders:               number
  revenueGross:         number   // sum of order totals incl. VAT + shipping
  aovGross:             number
  ordersWithRefund:     number
  refundRate:           number   // share of orders with at least one refund (0–1)
  refundedAmount:       number
  journeyOrders:        number   // orders with a ready customer journey
  newCustomerOrders:    number   // customerOrderIndex === 1
  topLandingPages:      { label: string; orders: number }[]
  topSources:           { label: string; orders: number }[]
}

/** Meta Ads, per device group. Clicks are counted by Meta (independent of the
 *  shop's cookie banner); the pixel actions depend on consent and attribution. */
export interface MetaDeviceRow {
  device:          'mobil' | 'desktop' | 'sonstige'
  linkClicks:      number
  landingPageViews: number
  addToCart:       number
  initiateCheckout: number
  purchases:       number
}

export interface AuditLiveMetrics {
  from: string
  to:   string
  timezone: string
  meta:          Status<MetaDeviceRow[]>
  abandonedCheckouts: Status<number>
  funnel:        Status<FunnelRow[]>
  landingPages:  Status<RankedRow[]>
  referrers:     Status<RankedRow[]>
  orders:        Status<OrderMetrics>
  journey:       Status<true>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ymd(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function num(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function errMsg(e: unknown) {
  return (e as Error)?.message ?? String(e)
}

// ─── ShopifyQL ──────────────────────────────────────────────────────────────

const SHOPIFYQL_GQL = `
  query AuditQuery($query: String!) {
    shopifyqlQuery(query: $query) {
      tableData { columns { name dataType } rows }
      parseErrors
    }
  }
`

type ShopifyqlResp = {
  shopifyqlQuery: {
    tableData: { columns: { name: string }[]; rows: Record<string, string | null>[] } | null
    parseErrors: string[]
  }
}

async function shopifyql(query: string) {
  const data = await shopifyGraphQL<ShopifyqlResp>(SHOPIFYQL_GQL, { query }, SHOPIFYQL_API_VERSION)
  const { tableData, parseErrors } = data.shopifyqlQuery
  if (parseErrors?.length) throw new Error(`ShopifyQL: ${parseErrors.join('; ')}`)
  return tableData?.rows ?? []
}

/**
 * Field names of the sessions dataset could not be verified against a live
 * store when this was written. Each query lists candidate dimensions and uses
 * the first that parses; the one used is reported back as a note.
 */
async function firstThatParses(candidates: string[], build: (dim: string) => string) {
  const errors: string[] = []
  for (const dim of candidates) {
    try {
      return { rows: await shopifyql(build(dim)), dim }
    } catch (e) {
      errors.push(`${dim}: ${errMsg(e)}`)
    }
  }
  throw new Error(errors.join(' | '))
}

async function getFunnel(from: string, to: string): Promise<Status<FunnelRow[]>> {
  try {
    const { rows, dim } = await firstThatParses(
      ['session_device_type'],
      d => `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout GROUP BY ${d} SINCE ${from} UNTIL ${to}`,
    )
    const data = rows.map(r => ({
      device:            String(r[dim] ?? 'unbekannt'),
      sessions:          num(r.sessions),
      addedToCart:       num(r.sessions_with_cart_additions),
      reachedCheckout:   num(r.sessions_that_reached_checkout),
      completedCheckout: num(r.sessions_that_completed_checkout),
    })).sort((a, b) => b.sessions - a.sessions)
    return { ok: true, data, note: `ShopifyQL sessions, GROUP BY ${dim}` }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

async function getRanked(from: string, to: string, candidates: string[]): Promise<Status<RankedRow[]>> {
  try {
    const { rows, dim } = await firstThatParses(
      candidates,
      d => `FROM sessions SHOW sessions, sessions_that_completed_checkout GROUP BY ${d} SINCE ${from} UNTIL ${to} ORDER BY sessions DESC LIMIT 10`,
    )
    return {
      ok: true,
      data: rows.map(r => ({
        label:       String(r[dim] ?? '—'),
        sessions:    num(r.sessions),
        conversions: r.sessions_that_completed_checkout == null ? null : num(r.sessions_that_completed_checkout),
      })),
      note: `ShopifyQL sessions, GROUP BY ${dim}`,
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

// ─── Orders (GraphQL, read_orders) ──────────────────────────────────────────

const ORDER_FIELDS = `
  id
  test
  cancelledAt
  totalPriceSet    { shopMoney { amount } }
  totalRefundedSet { shopMoney { amount } }
`

const JOURNEY_FIELDS = `
  customerJourneySummary {
    ready
    customerOrderIndex
    firstVisit { landingPage source sourceType }
  }
`

function ordersQuery(withJourney: boolean) {
  return `
    query AuditOrders($after: String, $query: String!) {
      orders(first: 250, after: $after, query: $query, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_FIELDS} ${withJourney ? JOURNEY_FIELDS : ''} }
      }
    }
  `
}

interface OrderNode {
  test: boolean
  cancelledAt: string | null
  totalPriceSet:    { shopMoney: { amount: string } }
  totalRefundedSet: { shopMoney: { amount: string } }
  customerJourneySummary?: {
    ready: boolean
    customerOrderIndex: number | null
    firstVisit: { landingPage: string | null; source: string | null; sourceType: string | null } | null
  } | null
}

async function fetchOrders(from: string, to: string, withJourney: boolean) {
  const all: OrderNode[] = []
  let after: string | null = null
  const query = `created_at:>=${from} created_at:<=${to}T23:59:59`
  for (let page = 0; page < 40; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: OrderNode[] } } =
      await shopifyGraphQL(ordersQuery(withJourney), { after, query })
    all.push(...data.orders.nodes)
    if (!data.orders.pageInfo.hasNextPage) break
    after = data.orders.pageInfo.endCursor
  }
  return all
}

function landingPath(url: string | null) {
  if (!url) return '(unbekannt)'
  try { return new URL(url).pathname || '/' } catch { return url.split('?')[0] }
}

function top(map: Map<string, number>, n: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, orders]) => ({ label, orders }))
}

async function getOrderMetrics(from: string, to: string): Promise<{ orders: Status<OrderMetrics>; journey: Status<true> }> {
  let nodes: OrderNode[]
  let journey: Status<true>
  try {
    nodes   = await fetchOrders(from, to, true)
    journey = { ok: true, data: true }
  } catch (e) {
    journey = { ok: false, error: errMsg(e) }
    try {
      nodes = await fetchOrders(from, to, false)
    } catch (e2) {
      return { orders: { ok: false, error: errMsg(e2) }, journey }
    }
  }

  const valid = nodes.filter(o => !o.test && !o.cancelledAt)
  const revenue  = valid.reduce((s, o) => s + num(o.totalPriceSet.shopMoney.amount), 0)
  const refunded = valid.filter(o => num(o.totalRefundedSet.shopMoney.amount) > 0)

  const withJourney = valid.filter(o => o.customerJourneySummary?.ready)
  const landing = new Map<string, number>()
  const sources = new Map<string, number>()
  for (const o of withJourney) {
    const fv = o.customerJourneySummary?.firstVisit
    const lp = landingPath(fv?.landingPage ?? null)
    landing.set(lp, (landing.get(lp) ?? 0) + 1)
    const src = [fv?.sourceType, fv?.source].filter(Boolean).join(' · ') || '(direkt/unbekannt)'
    sources.set(src, (sources.get(src) ?? 0) + 1)
  }

  return {
    journey,
    orders: {
      ok: true,
      data: {
        orders:            valid.length,
        revenueGross:      revenue,
        aovGross:          valid.length ? revenue / valid.length : 0,
        ordersWithRefund:  refunded.length,
        refundRate:        valid.length ? refunded.length / valid.length : 0,
        refundedAmount:    refunded.reduce((s, o) => s + num(o.totalRefundedSet.shopMoney.amount), 0),
        journeyOrders:     withJourney.length,
        newCustomerOrders: withJourney.filter(o => o.customerJourneySummary?.customerOrderIndex === 1).length,
        topLandingPages:   top(landing, 8),
        topSources:        top(sources, 8),
      },
    },
  }
}

// ─── Meta Ads (top of funnel) ───────────────────────────────────────────────

interface MetaBreakdownRow {
  device_platform?: string
  inline_link_clicks?: string
  actions?: { action_type: string; value: string }[]
}

function action(row: MetaBreakdownRow, types: string[]) {
  for (const t of types) {
    const hit = row.actions?.find(a => a.action_type === t)
    if (hit) return num(hit.value)
  }
  return 0
}

async function getMetaFunnel(from: string, to: string): Promise<Status<MetaDeviceRow[]>> {
  try {
    const res = await metaFetch<{ data: MetaBreakdownRow[] }>(`/${getAccountId()}/insights`, {
      fields:     'inline_link_clicks,actions',
      time_range: JSON.stringify({ since: from, until: to }),
      level:      'account',
      breakdowns: 'device_platform',
      limit:      '50',
    })
    const groups = new Map<MetaDeviceRow['device'], MetaDeviceRow>()
    for (const r of res.data ?? []) {
      const p = r.device_platform ?? ''
      const device: MetaDeviceRow['device'] = p.startsWith('mobile') ? 'mobil' : p === 'desktop' ? 'desktop' : 'sonstige'
      const g = groups.get(device) ?? { device, linkClicks: 0, landingPageViews: 0, addToCart: 0, initiateCheckout: 0, purchases: 0 }
      g.linkClicks       += num(r.inline_link_clicks)
      g.landingPageViews += action(r, ['landing_page_view', 'omni_landing_page_view'])
      g.addToCart        += action(r, ['omni_add_to_cart', 'add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'])
      g.initiateCheckout += action(r, ['omni_initiated_checkout', 'initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'])
      g.purchases        += action(r, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
      groups.set(device, g)
    }
    return { ok: true, data: [...groups.values()], note: 'Meta Marketing API, breakdown device_platform' }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

// ─── Abandoned checkouts (Admin API) ────────────────────────────────────────
// Shopify keeps a checkout once contact details were entered. Orders plus
// abandoned checkouts = checkouts started (from the contact step on).

async function getAbandonedCheckoutCount(from: string, to: string): Promise<Status<number>> {
  const q = `
    query AuditAbandoned($after: String, $query: String!) {
      abandonedCheckouts(first: 250, after: $after, query: $query) {
        pageInfo { hasNextPage endCursor }
        nodes { id }
      }
    }
  `
  try {
    let after: string | null = null
    let count = 0
    for (let page = 0; page < 60; page++) {
      const data: { abandonedCheckouts: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: { id: string }[] } } =
        await shopifyGraphQL(q, { after, query: `created_at:>=${from} created_at:<=${to}T23:59:59` })
      count += data.abandonedCheckouts.nodes.length
      if (!data.abandonedCheckouts.pageInfo.hasNextPage) break
      after = data.abandonedCheckouts.pageInfo.endCursor
    }
    return { ok: true, data: count, note: 'Admin GraphQL abandonedCheckouts' }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function getAuditLiveMetrics(fromDate: string): Promise<AuditLiveMetrics> {
  const tz   = await getShopTimezone().catch(() => 'Europe/Vienna')
  const to   = ymd(new Date(), tz)
  const from = fromDate

  const [funnel, landingPages, referrers, orderPart, meta, abandonedCheckouts] = await Promise.all([
    getFunnel(from, to),
    getRanked(from, to, ['session_landing_page_path', 'landing_page_path']),
    getRanked(from, to, ['session_referrer_source', 'referrer_source', 'session_referrer_name', 'referrer_name']),
    getOrderMetrics(from, to),
    getMetaFunnel(from, to),
    getAbandonedCheckoutCount(from, to),
  ])

  return {
    from, to, timezone: tz,
    meta, abandonedCheckouts, funnel, landingPages, referrers,
    orders: orderPart.orders, journey: orderPart.journey,
  }
}
