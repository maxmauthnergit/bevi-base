import { weshipFetch } from './client'
import type { WeShipProduct, WeShipProductsResponse } from './client'

// ─── Stock levels from WeShip ─────────────────────────────────────────────────

export interface WeShipStockLevel {
  sku: string
  name: string
  on_stock: number        // sum of all on_stock[].quantity
  outgoing: number        // sum of all outgoing_stock[].quantity (in transit)
}

export async function getWeShipStock(): Promise<WeShipStockLevel[]> {
  const data = await weshipFetch<WeShipProductsResponse>(
    '/mapi/product/search',
    { next: { revalidate: 0 } }
  )

  return (data.rows ?? []).map((p: WeShipProduct) => ({
    sku:      p.sku,
    name:     p.name,
    on_stock: (p.on_stock ?? []).reduce((s, e) => s + (e.quantity ?? 0), 0),
    outgoing: (p.outgoing_stock ?? []).reduce((s, e) => s + (e.quantity ?? 0), 0),
  }))
}

// ─── Stock breakdown (reserved / incoming / unavailable) ─────────────────────
// The product payload's stock fields beyond on_stock / outgoing_stock aren't
// documented, so every numeric or [{quantity}] field is collected and matched
// by name. `fields` exposes what was actually found.

export interface WeShipStockBreakdown {
  sku: string
  name: string
  on_stock: number
  reserved: number            // explicit reserved field, else outgoing_stock
  reserved_source: string | null
  incoming: number | null
  unavailable: number | null
  unreserved: number          // on_stock − reserved
  total: number               // unreserved + incoming + unavailable
  fields: Record<string, number>
}

const RESERVED_RE    = /reserv/i
const INCOMING_RE    = /incoming|inbound|expected/i
const UNAVAILABLE_RE = /unavailable|not_available|blocked|damaged|quarantin|defect/i
const STOCK_KEY_RE   = /stock|qty|quantity|reserv|incoming|inbound|unavailable|blocked|damaged|available/i

function stockQuantity(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && value.every(e => e && typeof e === 'object' && 'quantity' in e)) {
    return value.reduce((s: number, e: { quantity?: number }) => s + (e.quantity ?? 0), 0)
  }
  return null
}

function pickField(fields: Record<string, number>, re: RegExp): [string, number] | null {
  const hits = Object.entries(fields).filter(([k]) => re.test(k))
  if (hits.length === 0) return null
  return [hits.map(([k]) => k).join(' + '), hits.reduce((s, [, v]) => s + v, 0)]
}

export async function getWeShipStockBreakdown(): Promise<WeShipStockBreakdown[]> {
  const data = await weshipFetch<{ rows?: Record<string, unknown>[] }>('/mapi/product/search')

  return (data.rows ?? []).map((p) => {
    const fields: Record<string, number> = {}
    for (const [key, value] of Object.entries(p)) {
      if (!STOCK_KEY_RE.test(key)) continue
      const q = stockQuantity(value)
      if (q !== null) fields[key] = q
    }

    const on_stock    = fields.on_stock ?? 0
    const reservedHit = pickField(fields, RESERVED_RE)
    const reserved    = reservedHit?.[1] ?? fields.outgoing_stock ?? 0
    const incoming    = pickField(fields, INCOMING_RE)?.[1] ?? null
    const unavailable = pickField(fields, UNAVAILABLE_RE)?.[1] ?? null
    const unreserved  = Math.max(0, on_stock - reserved)

    return {
      sku:  String(p.sku ?? ''),
      name: String(p.name ?? ''),
      on_stock,
      reserved,
      reserved_source: reservedHit?.[0] ?? ('outgoing_stock' in fields ? 'outgoing_stock' : null),
      incoming,
      unavailable,
      unreserved,
      total: unreserved + (incoming ?? 0) + (unavailable ?? 0),
      fields,
    }
  })
}
