import { shopifyFetchAllOrders } from './client'

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

export async function getSalesSummaryForRange(from: Date, to: Date): Promise<SalesSummary> {
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
