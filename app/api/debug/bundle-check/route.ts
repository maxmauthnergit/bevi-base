import { NextResponse } from 'next/server'
import { shopifyFetch, shopifyUrl } from '@/lib/shopify/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Fetch the 20 most recent orders to inspect line item structure
  const url = shopifyUrl('/orders.json') + '?' + new URLSearchParams({
    status: 'any',
    limit: '20',
    fields: 'id,name,line_items',
  })

  const data = await shopifyFetch<{ orders: { id: number; name: string; line_items: { id: number; title: string; variant_title: string | null; sku: string; product_id: number; properties: { name: string; value: string }[] }[] }[] }>(url, { next: { revalidate: 0 } })

  const orders = data.orders.map(o => ({
    name: o.name,
    line_items: o.line_items.map(li => ({
      title:         li.title,
      variant_title: li.variant_title,
      sku:           li.sku,
      product_id:    li.product_id,
      properties:    li.properties ?? [],
    })),
  }))

  // Collect all unique property names seen across all orders
  const allPropNames = new Set<string>()
  for (const o of orders) {
    for (const li of o.line_items) {
      for (const p of li.properties) {
        allPropNames.add(p.name)
      }
    }
  }

  // Flag any line item with no SKU
  const noSkuItems = orders.flatMap(o =>
    o.line_items
      .filter(li => !li.sku)
      .map(li => ({ order: o.name, title: li.title, variant_title: li.variant_title }))
  )

  return NextResponse.json({
    orders,
    summary: {
      total_orders:     orders.length,
      unique_prop_names: [...allPropNames],
      no_sku_line_items: noSkuItems,
    },
  })
}
