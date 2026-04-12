import { NextResponse } from 'next/server'
import { weshipFetch } from '@/lib/weship/client'
import type { WeShipProductsResponse, WeShipOrdersResponse } from '@/lib/weship/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const products = await weshipFetch<WeShipProductsResponse>('/mapi/product/search')
    results.products = {
      ok: true,
      total: products.total,
      count: products.count_rows,
      first: products.rows?.[0] ?? null,
    }
  } catch (e) {
    results.products = { ok: false, error: String(e) }
  }

  try {
    const orders = await weshipFetch<WeShipOrdersResponse>('/mapi/order/search')
    results.orders = {
      ok: true,
      total: orders.total,
      count: orders.count_rows,
      first: orders.rows?.[0] ?? null,
    }
  } catch (e) {
    results.orders = { ok: false, error: String(e) }
  }

  return NextResponse.json({ ok: true, results })
}
