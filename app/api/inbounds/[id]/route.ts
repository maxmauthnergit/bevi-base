import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { INVOICE_BUCKET } from '@/lib/inbounds'
import { writeChildren, type InboundPayload } from '../route'

const fxOrNull = (v: unknown) => {
  const num = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(num) || num <= 0 ? null : num
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body   = await req.json() as InboundPayload

  if (!body.charge?.trim()) return NextResponse.json({ error: 'charge is required' }, { status: 422 })
  if (!body.order_date)     return NextResponse.json({ error: 'order_date is required' }, { status: 422 })

  const db = createServerClient()

  const { error } = await db
    .from('inbounds')
    .update({
      charge:     body.charge.trim(),
      order_date: body.order_date,
      notes:      body.notes ?? '',
      production_fx_usd_eur: fxOrNull(body.production_fx_usd_eur),
      production_fx_date:    body.production_fx_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    const conflict = error.code === '23505'
    return NextResponse.json(
      { error: conflict ? `Charge "${body.charge.trim()}" already exists` : error.message },
      { status: conflict ? 409 : 500 },
    )
  }

  const childErr = await writeChildren(db, id, body)
  if (childErr) return NextResponse.json({ error: childErr }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const db     = createServerClient()

  // Rows cascade, but storage objects would just be orphaned.
  const { data: invoices } = await db
    .from('inbound_invoices').select('path').eq('inbound_id', id)

  const paths = (invoices ?? []).map(i => i.path as string).filter(Boolean)
  if (paths.length > 0) await db.storage.from(INVOICE_BUCKET).remove(paths)

  const { error } = await db.from('inbounds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
