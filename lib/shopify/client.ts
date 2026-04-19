// ─── Shopify Admin API client ─────────────────────────────────────────────────

interface NextFetchRequestConfig {
  revalidate?: number | false
  tags?: string[]
}

const SHOPIFY_API_VERSION = '2025-01'

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_ACCESS_TOKEN

  if (!domain || !token) {
    throw new Error(
      'Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN.'
    )
  }

  return { domain, token }
}

export function shopifyUrl(path: string) {
  const { domain } = getShopifyConfig()
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`
}

export async function shopifyFetch<T>(
  path: string,
  options: RequestInit & { next?: NextFetchRequestConfig } = {}
): Promise<T> {
  const { token } = getShopifyConfig()
  const url = shopifyUrl(path)

  const { next, ...rest } = options as RequestInit & { next?: NextFetchRequestConfig }

  const res = await fetch(url, {
    ...rest,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
    next: next ?? { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

function parseLinkNext(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const [urlPart, relPart] = part.split(';').map(s => s.trim())
    if (relPart?.includes('rel="next"')) return urlPart.replace(/^<|>$/g, '')
  }
  return null
}

// Fetches all pages of orders for a date range using cursor pagination.
export async function shopifyFetchAllOrders(
  params: URLSearchParams,
  nextOpts: NextFetchRequestConfig = { revalidate: 300 },
): Promise<ShopifyOrder[]> {
  const { token } = getShopifyConfig()
  let url: string | null = shopifyUrl(`/orders.json?${params}`)
  const all: ShopifyOrder[] = []

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      next: nextOpts,
    })
    if (!res.ok) throw new Error(`Shopify API error ${res.status}: ${await res.text()}`)
    const { orders } = await res.json() as { orders: ShopifyOrder[] }
    all.push(...orders)
    url = parseLinkNext(res.headers.get('link'))
  }

  return all
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface ShopifyShop {
  id: number
  name: string
  email: string
  domain: string
  myshopify_domain: string
  plan_name: string
  currency: string
  country_name: string
  timezone: string
  iana_timezone: string
}

export interface ShopifyOrder {
  id: number
  name: string               // e.g. "#1001"
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string        // gross, string from Shopify
  subtotal_price: string
  total_tax: string
  total_discounts: string
  currency: string
  email: string
  cancel_reason: string | null
  cancelled_at: string | null
  refunds: ShopifyRefund[]
  line_items: ShopifyLineItem[]
  billing_address?: { country_code: string }
  shipping_address?: { country_code: string }
  discount_codes: { code: string; amount: string }[]
}

export interface ShopifyRefund {
  id: number
  created_at: string
  refund_line_items: { quantity: number; line_item_id: number }[]
  transactions: { id: number; amount: string; kind: string; status: string }[]
}

export interface ShopifyLineItem {
  id: number
  product_id: number
  variant_id: number
  title: string
  variant_title: string | null
  sku: string
  quantity: number
  price: string
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  status: string
  variants: ShopifyVariant[]
}

export interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  sku: string
  price: string
  inventory_quantity: number
}
