import { NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyShop, ShopifyOrder, ShopifyProduct } from '@/lib/shopify/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}
  const errors: Record<string, string> = {}

  // 1. Shop info — confirms credentials are valid
  try {
    const data = await shopifyFetch<{ shop: ShopifyShop }>('/shop.json')
    results.shop = {
      name: data.shop.name,
      domain: data.shop.myshopify_domain,
      plan: data.shop.plan_name,
      currency: data.shop.currency,
      country: data.shop.country_name,
      timezone: data.shop.iana_timezone,
    }
  } catch (e) {
    errors.shop = String(e)
  }

  // 2. Recent orders — last 5
  try {
    const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
      '/orders.json?status=any&limit=5&order=created_at+desc'
    )
    results.recent_orders = data.orders.map((o) => ({
      name: o.name,
      created_at: o.created_at,
      total_price: o.total_price,
      currency: o.currency,
      financial_status: o.financial_status,
      line_items: o.line_items.length,
    }))
    results.orders_retrieved = data.orders.length
  } catch (e) {
    errors.orders = String(e)
  }

  // 3. Products — first 5
  try {
    const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
      '/products.json?limit=5&status=active'
    )
    results.products = data.products.map((p) => ({
      title: p.title,
      handle: p.handle,
      variants: p.variants.map((v) => ({
        sku: v.sku,
        title: v.title,
        price: v.price,
        inventory: v.inventory_quantity,
      })),
    }))
  } catch (e) {
    errors.products = String(e)
  }

  const ok = Object.keys(errors).length === 0

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    },
    { status: ok ? 200 : 500 }
  )
}
