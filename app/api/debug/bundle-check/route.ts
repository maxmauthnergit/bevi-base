import { NextResponse } from 'next/server'
import { shopifyUrl } from '@/lib/shopify/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = process.env.SHOPIFY_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'No Shopify token' }, { status: 500 })

  const url = shopifyUrl('/orders.json') + '?' + new URLSearchParams({
    status: 'any',
    limit: '20',
    fields: 'id,name,tags,note_attributes,line_items',
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
      tags: string
      note_attributes: { name: string; value: string }[]
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
    name:            o.name,
    tags:            o.tags,
    note_attributes: o.note_attributes ?? [],
    line_items: o.line_items.map(li => ({
      title:         li.title,
      variant_title: li.variant_title,
      sku:           li.sku,
      product_id:    li.product_id,
      properties:    li.properties ?? [],
    })),
  }))

  const allPropNames   = new Set<string>()
  const allNoteAttrNames = new Set<string>()
  const allTags        = new Set<string>()

  for (const o of mapped) {
    for (const t of (o.tags ?? '').split(',').map(s => s.trim()).filter(Boolean)) allTags.add(t)
    for (const a of o.note_attributes) allNoteAttrNames.add(a.name)
    for (const li of o.line_items) {
      for (const p of li.properties) allPropNames.add(p.name)
    }
  }

  return NextResponse.json({
    orders: mapped,
    summary: {
      total_orders:           mapped.length,
      unique_tags:            [...allTags],
      unique_note_attr_names: [...allNoteAttrNames],
      unique_line_item_props: [...allPropNames],
    },
  })
}
