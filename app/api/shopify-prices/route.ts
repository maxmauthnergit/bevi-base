import { NextResponse } from 'next/server'
import { shopifyFetch } from '@/lib/shopify/client'
import type { ShopifyProduct } from '@/lib/shopify/client'

// Maps our internal product IDs to title keyword(s) that uniquely identify
// the Shopify product. Keywords are matched case-insensitively against the
// product title. All keywords in an entry must match (AND logic).
const MATCHERS: { id: string; include: string[]; exclude?: string[] }[] = [
  { id: 'bevi-bag',      include: ['full set'],       exclude: ['bundle', 'squad'] },
  { id: 'water-bladder', include: ['water bladder']                                },
  { id: 'phone-strap',   include: ['phone strap']                                  },
  { id: 'cleaning-kit',  include: ['cleaning kit'],   exclude: ['bundle']          },
]

export async function GET() {
  try {
    const { products } = await shopifyFetch<{ products: ShopifyProduct[] }>(
      '/products.json?status=active&fields=id,title,handle,variants&limit=250',
      { next: { revalidate: 3600 } }
    )

    const prices: Record<string, number> = {}

    for (const matcher of MATCHERS) {
      const match = products.find(p => {
        const t = p.title.toLowerCase()
        const included = matcher.include.every(k => t.includes(k))
        const excluded = matcher.exclude?.some(k => t.includes(k)) ?? false
        return included && !excluded
      })
      if (match?.variants?.[0]?.price) {
        prices[matcher.id] = parseFloat(match.variants[0].price)
      }
    }

    return NextResponse.json({ prices })
  } catch (err) {
    return NextResponse.json({ error: String(err), prices: {} }, { status: 500 })
  }
}
