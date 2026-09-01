import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { usdToEur, type Inbound, type InboundItem, type InboundShipment, type ShipMode } from '@/lib/inbounds'

const SELECT = `
  id, charge, order_date, notes, created_at,
  production_fx_usd_eur, production_fx_date,
  inbound_items (
    product_id, quantity, production_cost_usd, production_cost_eur, supplier_id, position
  ),
  inbound_shipments (
    id, mode, shipping_company_id, cost_usd, cost_eur, fx_usd_eur, fx_date,
    planned_arrival, actual_arrival, position,
    inbound_shipment_items ( product_id, quantity )
  ),
  inbound_invoices ( id, shipment_id, filename, content_type, size_bytes, uploaded_at )
`

type Num = number | string

interface RawItem {
  product_id: string; quantity: Num
  production_cost_usd: Num; production_cost_eur: Num
  supplier_id: string | null; position: Num
}
interface RawShipItem { product_id: string; quantity: Num }
interface RawShipment {
  id: string; mode: string; shipping_company_id: string | null
  cost_usd: Num; cost_eur: Num; fx_usd_eur: Num | null; fx_date: string | null
  planned_arrival: string | null; actual_arrival: string | null; position: Num
  inbound_shipment_items: RawShipItem[]
}

// PostgREST hands numeric columns back as numbers, but be explicit — a string
// slipping through would turn every sum into concatenation.
const n = (v: Num) => Number(v) || 0
// A rate must stay distinguishable from "not set": 0 would read as free.
const rate = (v: Num | null) => (v === null || v === '' ? null : Number(v) || null)

function shapeRow(row: Record<string, unknown>): Inbound {
  const items     = (row.inbound_items     as RawItem[]     ?? [])
  const shipments = (row.inbound_shipments as RawShipment[] ?? [])

  return {
    id:         row.id         as string,
    charge:     row.charge     as string,
    order_date: row.order_date as string,
    notes:      row.notes      as string,
    created_at: row.created_at as string,
    production_fx_usd_eur: rate(row.production_fx_usd_eur as Num | null),
    production_fx_date:    (row.production_fx_date as string | null) ?? null,
    items: [...items]
      .sort((a, b) => n(a.position) - n(b.position))
      .map(it => ({
        product_id:          it.product_id,
        quantity:            n(it.quantity),
        production_cost_usd: n(it.production_cost_usd),
        production_cost_eur: n(it.production_cost_eur),
        supplier_id:         it.supplier_id,
      })),
    shipments: [...shipments]
      .sort((a, b) => n(a.position) - n(b.position))
      .map(sh => ({
        id:                  sh.id,
        mode:                sh.mode as ShipMode,
        shipping_company_id: sh.shipping_company_id,
        cost_usd:            n(sh.cost_usd),
        cost_eur:            n(sh.cost_eur),
        fx_usd_eur:          rate(sh.fx_usd_eur),
        fx_date:             sh.fx_date,
        planned_arrival:     sh.planned_arrival,
        actual_arrival:      sh.actual_arrival,
        items: (sh.inbound_shipment_items ?? []).map(si => ({
          product_id: si.product_id,
          quantity:   n(si.quantity),
        })),
      })),
    invoices: (row.inbound_invoices as Inbound['invoices'] ?? []),
  }
}

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db
    .from('inbounds')
    .select(SELECT)
    .order('order_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inbounds: (data ?? []).map(r => shapeRow(r as Record<string, unknown>)) })
}

export interface InboundPayload {
  charge:     string
  order_date: string
  notes?:     string
  production_fx_usd_eur?: number | null
  production_fx_date?:    string | null
  items?:     Partial<InboundItem>[]
  shipments?: Partial<InboundShipment>[]
}

// EUR is always USD × rate, computed here rather than trusted from the client,
// so the stored figure cannot drift from the amount and rate stored beside it.
const toEur = (usd: unknown, fx: unknown) =>
  usdToEur(Number(usd) || 0, fx === null || fx === undefined ? null : Number(fx)) ?? 0

const fxOrNull = (v: unknown) => {
  const num = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(num) || num <= 0 ? null : num
}

/**
 * Writes the production positions and the shipments of one charge. Both are
 * replaced wholesale — the editor always submits the full set, and a diff would
 * only add ways for the two sides to drift apart.
 */
export async function writeChildren(
  db: SupabaseClient,
  inboundId: string,
  body: InboundPayload,
): Promise<string | null> {
  if (body.items) {
    const { error } = await db.from('inbound_items').delete().eq('inbound_id', inboundId)
    if (error) return error.message

    const productionFx = fxOrNull(body.production_fx_usd_eur)
    const items = body.items.filter(it => it.product_id)
    if (items.length > 0) {
      const { error: insErr } = await db.from('inbound_items').insert(
        items.map((it, i) => ({
          inbound_id:          inboundId,
          product_id:          it.product_id,
          quantity:            Number(it.quantity) || 0,
          production_cost_usd: Number(it.production_cost_usd) || 0,
          production_cost_eur: toEur(it.production_cost_usd, productionFx),
          supplier_id:         it.supplier_id || null,
          position:            i,
        })),
      )
      if (insErr) return insErr.message
    }
  }

  if (body.shipments) {
    const shipments = body.shipments.filter(sh => sh.mode)

    // Shipments are updated in place rather than replaced: invoices reference
    // them, and deleting a row would cascade the invoice away with it. Only
    // shipments the editor no longer sends are actually removed.
    const keptIds = shipments.map(sh => sh.id).filter((id): id is string => !!id)
    const { error: delErr } = keptIds.length > 0
      ? await db.from('inbound_shipments').delete()
          .eq('inbound_id', inboundId)
          .not('id', 'in', `(${keptIds.join(',')})`)
      : await db.from('inbound_shipments').delete().eq('inbound_id', inboundId)
    if (delErr) return delErr.message

    for (const [i, sh] of shipments.entries()) {
      const fx  = fxOrNull(sh.fx_usd_eur)
      const row = {
        inbound_id:          inboundId,
        mode:                sh.mode,
        shipping_company_id: sh.shipping_company_id || null,
        cost_usd:            Number(sh.cost_usd) || 0,
        cost_eur:            toEur(sh.cost_usd, fx),
        fx_usd_eur:          fx,
        fx_date:             sh.fx_date || null,
        planned_arrival:     sh.planned_arrival || null,
        actual_arrival:      sh.actual_arrival  || null,
        position:            i,
      }

      let shipmentId = sh.id
      if (shipmentId) {
        const { error } = await db.from('inbound_shipments').update(row).eq('id', shipmentId)
        if (error) return error.message
      } else {
        const { data, error } = await db.from('inbound_shipments').insert(row).select('id').single()
        if (error) return error.message
        shipmentId = data.id
      }

      // Nothing references the allocation lines, so those can be replaced.
      const { error: liDelErr } = await db
        .from('inbound_shipment_items').delete().eq('shipment_id', shipmentId)
      if (liDelErr) return liDelErr.message

      const lines = (sh.items ?? []).filter(si => si.product_id && Number(si.quantity) > 0)
      if (lines.length > 0) {
        const { error: liErr } = await db.from('inbound_shipment_items').insert(
          lines.map(si => ({
            shipment_id: shipmentId,
            product_id:  si.product_id,
            quantity:    Number(si.quantity) || 0,
          })),
        )
        if (liErr) return liErr.message
      }
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json() as InboundPayload

  if (!body.charge?.trim()) return NextResponse.json({ error: 'charge is required' }, { status: 422 })
  if (!body.order_date)     return NextResponse.json({ error: 'order_date is required' }, { status: 422 })

  const db = createServerClient()

  const { data, error } = await db
    .from('inbounds')
    .insert({
      charge:     body.charge.trim(),
      order_date: body.order_date,
      notes:      body.notes ?? '',
      production_fx_usd_eur: fxOrNull(body.production_fx_usd_eur),
      production_fx_date:    body.production_fx_date || null,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation on charge
    const conflict = error.code === '23505'
    return NextResponse.json(
      { error: conflict ? `Charge "${body.charge.trim()}" already exists` : error.message },
      { status: conflict ? 409 : 500 },
    )
  }

  const childErr = await writeChildren(db, data.id, body)
  if (childErr) {
    // Don't leave a header row behind with no positions.
    await db.from('inbounds').delete().eq('id', data.id)
    return NextResponse.json({ error: childErr }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
