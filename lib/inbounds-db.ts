// ─── Inbounds from Supabase ──────────────────────────────────────────────────
// One nested select for a charge with its positions, shipments and invoices,
// shaped into the Inbound type. Shared by the inbounds API and the COGS engine.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Inbound, ShipMode } from '@/lib/inbounds'

export const SELECT = `
  id, name, order_date, notes, created_at,
  production_fx_usd_eur, production_fx_date,
  inbound_items (
    product_id, charge, quantity, production_cost_usd, production_cost_eur, supplier_id, position
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
  product_id: string; charge: string | null; quantity: Num
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

export function shapeRow(row: Record<string, unknown>): Inbound {
  const items     = (row.inbound_items     as RawItem[]     ?? [])
  const shipments = (row.inbound_shipments as RawShipment[] ?? [])

  return {
    id:         row.id         as string,
    name:       row.name       as string,
    order_date: row.order_date as string,
    notes:      row.notes      as string,
    created_at: row.created_at as string,
    production_fx_usd_eur: rate(row.production_fx_usd_eur as Num | null),
    production_fx_date:    (row.production_fx_date as string | null) ?? null,
    items: [...items]
      .sort((a, b) => n(a.position) - n(b.position))
      .map(it => ({
        product_id:          it.product_id,
        charge:              it.charge ?? '',
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


export async function fetchInbounds(db: SupabaseClient): Promise<Inbound[]> {
  const { data, error } = await db
    .from('inbounds')
    .select(SELECT)
    .order('order_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => shapeRow(r as Record<string, unknown>))
}
