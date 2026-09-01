import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { Inbound, InboundItem } from '@/lib/inbounds'

const ITEM_COLS = 'product_id, quantity, production_cost_eur, shipping_cost_eur'

interface ItemRow {
  product_id:          string
  quantity:            number | string
  production_cost_eur: number | string
  shipping_cost_eur:   number | string
}

// PostgREST hands numeric columns back as numbers, but be explicit — a string
// slipping through would turn every sum into concatenation.
function normalizeItem(row: ItemRow): InboundItem {
  return {
    product_id:          row.product_id,
    quantity:            Number(row.quantity) || 0,
    production_cost_eur: Number(row.production_cost_eur) || 0,
    shipping_cost_eur:   Number(row.shipping_cost_eur) || 0,
  }
}

export async function GET() {
  const db = createServerClient()

  const { data, error } = await db
    .from('inbounds')
    .select(`id, charge_no, order_date, shipping_mode, weship_arrival_date,
             planned_weship_date_min, planned_weship_date_max,
             production_invoice_path, shipping_invoice_path, notes, created_at,
             inbound_items ( ${ITEM_COLS} )`)
    .order('order_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inbounds: Inbound[] = (data ?? []).map((row) => {
    const { inbound_items, ...rest } = row as typeof row & { inbound_items: ItemRow[] }
    return { ...rest, items: (inbound_items ?? []).map(normalizeItem) } as Inbound
  })

  return NextResponse.json({ inbounds })
}

export interface InboundPayload {
  charge_no:               string
  order_date:              string
  shipping_mode?:          string | null
  weship_arrival_date?:    string | null
  planned_weship_date_min?: string | null
  planned_weship_date_max?: string | null
  notes?:                  string
  items?:                  ItemRow[]
}

export async function POST(req: NextRequest) {
  const body = await req.json() as InboundPayload

  if (!body.charge_no?.trim()) return NextResponse.json({ error: 'charge_no is required' }, { status: 422 })
  if (!body.order_date)        return NextResponse.json({ error: 'order_date is required' }, { status: 422 })

  const db = createServerClient()

  const { data, error } = await db
    .from('inbounds')
    .insert({
      charge_no:               body.charge_no.trim(),
      order_date:              body.order_date,
      shipping_mode:           body.shipping_mode ?? null,
      weship_arrival_date:     body.weship_arrival_date || null,
      planned_weship_date_min: body.planned_weship_date_min || null,
      planned_weship_date_max: body.planned_weship_date_max || null,
      notes:                   body.notes ?? '',
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation on charge_no
    const status = error.code === '23505' ? 409 : 500
    const message = status === 409 ? `Charge # "${body.charge_no.trim()}" already exists` : error.message
    return NextResponse.json({ error: message }, { status })
  }

  const items = (body.items ?? []).filter(it => it.product_id)
  if (items.length > 0) {
    const { error: itemErr } = await db.from('inbound_items').insert(
      items.map(it => ({
        inbound_id:          data.id,
        product_id:          it.product_id,
        quantity:            Number(it.quantity) || 0,
        production_cost_eur: Number(it.production_cost_eur) || 0,
        shipping_cost_eur:   Number(it.shipping_cost_eur) || 0,
      })),
    )
    if (itemErr) {
      // Don't leave a header row behind with no positions.
      await db.from('inbounds').delete().eq('id', data.id)
      return NextResponse.json({ error: itemErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, id: data.id })
}
