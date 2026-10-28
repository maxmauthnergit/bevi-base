import { shopifyFetchAllOrders, shopifyGraphQL } from './client'
import { getShopTimezone, parseInTimezone } from './queries'

// ─── Sales summary (Shopify "Total sales breakdown") ─────────────────────────
// Every amount is excluding VAT, except Taxes itself:
//   Gross Sales − Discounts − Returns = Net Sales
//   Net Sales + Shipping + Taxes + Duties/Fees = Total Sales

export interface SalesSummary {
  gross_sales:  number
  discounts:    number   // positive amount, subtracted
  returns:      number   // positive amount, subtracted
  net_sales:    number
  shipping:     number
  taxes:        number
  duties_fees:  number
  total_sales:  number
  order_count:  number
}

export type SalesSummarySource = 'shopifyql' | 'orders'


interface TaxLine { price: string; rate: number }
interface MoneySet { shop_money: { amount: string } }

interface SalesOrder {
  id: number
  financial_status: string
  cancelled_at: string | null
  taxes_included: boolean
  line_items: {
    id: number
    price: string
    quantity: number
    tax_lines?: TaxLine[]
    discount_allocations?: { amount: string }[]
  }[]
  shipping_lines?: {
    price: string
    discounted_price?: string
    tax_lines?: TaxLine[]
  }[]
  refunds?: {
    refund_line_items?: { subtotal: number | string; total_tax: number | string }[]
    order_adjustments?: { kind: string; amount: string; tax_amount: string }[]
  }[]
  current_total_duties_set?: MoneySet | null
  current_total_additional_fees_set?: MoneySet | null
}

const FIELDS = [
  'id', 'financial_status', 'cancelled_at', 'taxes_included',
  'line_items', 'shipping_lines', 'refunds',
  'current_total_duties_set', 'current_total_additional_fees_set',
].join(',')

function num(v: string | number | null | undefined) {
  return typeof v === 'number' ? v : parseFloat(v ?? '') || 0
}

function sumTax(lines?: TaxLine[]) {
  return (lines ?? []).reduce((s, t) => s + num(t.price), 0)
}

function sumRate(lines?: TaxLine[]) {
  return (lines ?? []).reduce((s, t) => s + (t.rate || 0), 0)
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeSalesSummary(orders: SalesOrder[]): SalesSummary {
  let gross = 0, discounts = 0, returns = 0, shipping = 0, taxes = 0, duties = 0
  let orderCount = 0

  // Same convention as the other sales KPIs: voided and cancelled orders carry no revenue.
  for (const o of orders) {
    if (o.financial_status === 'voided' || o.cancelled_at) continue
    orderCount++
    const incl = o.taxes_included

    for (const li of o.line_items) {
      const lineTotal = num(li.price) * li.quantity
      const lineDisc  = (li.discount_allocations ?? []).reduce((s, d) => s + num(d.amount), 0)
      // With VAT-inclusive prices, strip VAT from price and discount via the line's rate.
      const factor    = incl ? 1 / (1 + sumRate(li.tax_lines)) : 1
      gross     += lineTotal * factor
      discounts += lineDisc  * factor
      taxes     += sumTax(li.tax_lines)
    }

    for (const sl of o.shipping_lines ?? []) {
      const price = num(sl.discounted_price ?? sl.price)
      const tax   = sumTax(sl.tax_lines)
      shipping += incl ? price - tax : price
      taxes    += tax
    }

    for (const rf of o.refunds ?? []) {
      for (const rli of rf.refund_line_items ?? []) {
        const sub = num(rli.subtotal)
        const tax = num(rli.total_tax)
        returns += incl ? sub - tax : sub
        taxes   -= tax
      }
      // Refunded shipping arrives as a negative order adjustment.
      for (const adj of rf.order_adjustments ?? []) {
        if (adj.kind !== 'shipping_refund') continue
        const amt = num(adj.amount)
        const tax = num(adj.tax_amount)
        shipping += incl ? amt - tax : amt
        taxes    += tax
      }
    }

    duties += num(o.current_total_duties_set?.shop_money.amount)
            + num(o.current_total_additional_fees_set?.shop_money.amount)
  }

  const net   = gross - discounts - returns
  const total = net + shipping + taxes + duties

  return {
    gross_sales: r2(gross),
    discounts:   r2(discounts),
    returns:     r2(returns),
    net_sales:   r2(net),
    shipping:    r2(shipping),
    taxes:       r2(taxes),
    duties_fees: r2(duties),
    total_sales: r2(total),
    order_count: orderCount,
  }
}

export async function getSalesSummaryFromOrders(from: Date, to: Date): Promise<SalesSummary> {
  const params = new URLSearchParams({
    status: 'any',
    created_at_min: from.toISOString(),
    created_at_max: to.toISOString(),
    limit: '250',
    fields: FIELDS,
  })
  const orders = await shopifyFetchAllOrders(params, { revalidate: 300 }) as unknown as SalesOrder[]
  return computeSalesSummary(orders)
}

// ─── ShopifyQL (Shopify Analytics numbers, 1:1) ──────────────────────────────
// Reads the same "Total sales breakdown" Shopify Analytics shows, so returns
// land on the day they happened and every edge case follows Shopify's own
// definitions. Needs Admin API 2025-10+, the read_reports scope and Level 2
// protected customer data access.

const SHOPIFYQL_API_VERSION = '2025-10'

const SHOPIFYQL_GQL = `
  query SalesSummary($query: String!) {
    shopifyqlQuery(query: $query) {
      tableData {
        columns { name dataType }
        rows
      }
      parseErrors
    }
  }
`

type ShopifyqlResp = {
  shopifyqlQuery: {
    tableData: { columns: { name: string; dataType: string }[]; rows: Record<string, string | null>[] } | null
    parseErrors: string[]
  }
}

// from/to are calendar days (YYYY-MM-DD); ShopifyQL reads them in the shop's timezone.
export async function getSalesSummaryFromShopifyQL(from: string, to: string): Promise<SalesSummary> {
  const query = [
    'FROM sales',
    'SHOW gross_sales, discounts, returns, net_sales, shipping_charges, taxes, duties, additional_fees, total_sales, orders',
    `SINCE ${from} UNTIL ${to}`,
  ].join(' ')

  const data = await shopifyGraphQL<ShopifyqlResp>(SHOPIFYQL_GQL, { query }, SHOPIFYQL_API_VERSION)
  const { tableData, parseErrors } = data.shopifyqlQuery
  if (parseErrors?.length) throw new Error(`ShopifyQL: ${parseErrors.join('; ')}`)

  // No GROUP BY → a single row of period totals (empty when there were no sales).
  const row = tableData?.rows[0] ?? {}
  const v = (name: string) => num(row[name])

  return {
    gross_sales: r2(v('gross_sales')),
    // Shopify reports deductions as negative amounts; the page shows them as positive and subtracts.
    discounts:   r2(Math.abs(v('discounts'))),
    returns:     r2(Math.abs(v('returns'))),
    net_sales:   r2(v('net_sales')),
    shipping:    r2(v('shipping_charges')),
    taxes:       r2(v('taxes')),
    duties_fees: r2(v('duties') + v('additional_fees')),
    total_sales: r2(v('total_sales')),
    order_count: Math.round(v('orders')),
  }
}

// ─── Preferred entry point ───────────────────────────────────────────────────
// ShopifyQL first; until the token carries read_reports + protected customer
// data access it is refused, so fall back to computing from orders.

export interface SalesSummaryResult {
  summary:         SalesSummary
  source:          SalesSummarySource
  fallbackReason?: string
}

export async function getSalesSummary(from: string, to: string): Promise<SalesSummaryResult> {
  try {
    return { summary: await getSalesSummaryFromShopifyQL(from, to), source: 'shopifyql' }
  } catch (err) {
    const fallbackReason = (err as Error).message
    console.warn('[sales-summary] ShopifyQL failed, falling back to orders:', fallbackReason)
    const tz = await getShopTimezone()
    const summary = await getSalesSummaryFromOrders(
      parseInTimezone(from, '00:00:00', tz),
      parseInTimezone(to,   '23:59:59', tz),
    )
    return { summary, source: 'orders', fallbackReason }
  }
}
