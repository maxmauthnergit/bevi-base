import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { INVOICE_BUCKET } from '@/lib/inbounds'
import type { InboundPayload } from '../route'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body   = await req.json() as InboundPayload

  if (!body.charge_no?.trim()) return NextResponse.json({ error: 'charge_no is required' }, { status: 422 })
  if (!body.order_date)        return NextResponse.json({ error: 'order_date is required' }, { status: 422 })

  const db = createServerClient()

  const { error } = await db
    .from('inbounds')
    .update({
      charge_no:               body.charge_no.trim(),
      order_date:              body.order_date,
      shipping_mode:           body.shipping_mode ?? null,
      weship_arrival_date:     body.weship_arrival_date || null,
      planned_weship_date_min: body.planned_weship_date_min || null,
      planned_weship_date_max: body.planned_weship_date_max || null,
      notes:                   body.notes ?? '',
      updated_at:              new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    const status  = error.code === '23505' ? 409 : 500
    const message = status === 409 ? `Charge # "${body.charge_no.trim()}" already exists` : error.message
    return NextResponse.json({ error: message }, { status })
  }

  // Positions are replaced wholesale — the editor always submits the full set,
  // and a diff would only add ways for the two to drift apart.
  if (body.items) {
    const { error: delErr } = await db.from('inbound_items').delete().eq('inbound_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    const items = body.items.filter(it => it.product_id)
    if (items.length > 0) {
      const { error: insErr } = await db.from('inbound_items').insert(
        items.map(it => ({
          inbound_id:          id,
          product_id:          it.product_id,
          quantity:            Number(it.quantity) || 0,
          production_cost_eur: Number(it.production_cost_eur) || 0,
          shipping_cost_eur:   Number(it.shipping_cost_eur) || 0,
        })),
      )
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const db     = createServerClient()

  // Remove the uploaded invoices first — inbound_items goes with the row via
  // ON DELETE CASCADE, but storage objects would just be orphaned.
  const { data: row } = await db
    .from('inbounds')
    .select('production_invoice_path, shipping_invoice_path')
    .eq('id', id)
    .maybeSingle()

  const paths = [row?.production_invoice_path, row?.shipping_invoice_path].filter(Boolean) as string[]
  if (paths.length > 0) {
    await db.storage.from(INVOICE_BUCKET).remove(paths)
  }

  const { error } = await db.from('inbounds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
