import { NextResponse } from 'next/server'
import { shopifyUrl } from '@/lib/shopify/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = process.env.SHOPIFY_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'No Shopify token' }, { status: 500 })

  const url = shopifyUrl('/orders.json') + '?' + new URLSearchParams({
    status: 'any',
    limit: '20',
    fields: 'id,name,line_items',
  })

  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Shopify ${res.status}`, body: await res.text() }, { status: 502 })
  }

  const { orders } = await res.json() as {
    orders: {
      id: number
      name: string
      line_items: {
        title: string
        variant_title: string | null
        sku: string
        product_id: number
        properties: { name: string; value: string }[]
      }[]
    }[]
  }

  const mapped = orders.map(o => ({
    name: o.name,
    line_items: o.line_items.map(li => ({
      title:         li.title,
      variant_title: li.variant_title,
      sku:           li.sku,
      product_id:    li.product_id,
      properties:    li.properties ?? [],
    })),
  }))

  const allPropNames = new Set<string>()
  for (const o of mapped) {
    for (const li of o.line_items) {
      for (const p of li.properties) allPropNames.add(p.name)
    }
  }

  const noSkuItems = mapped.flatMap(o =>
    o.line_items
      .filter(li => !li.sku)
      .map(li => ({ order: o.name, title: li.title, variant_title: li.variant_title }))
  )

  return NextResponse.json({
    orders: mapped,
    summary: {
      total_orders:      mapped.length,
      unique_prop_names: [...allPropNames],
      no_sku_line_items: noSkuItems,
    },
  })
}
