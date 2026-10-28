import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { INVOICE_BUCKET } from '@/lib/inbounds'

type Ctx = { params: Promise<{ id: string; invoiceId: string }> }

/** Short-lived signed URL, as the WeShip invoice download does. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, invoiceId } = await ctx.params
  const db = createServerClient()

  const { data: row } = await db
    .from('inbound_invoices').select('path')
    .eq('id', invoiceId).eq('inbound_id', id).maybeSingle()

  if (!row?.path) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data, error } = await db.storage.from(INVOICE_BUCKET).createSignedUrl(row.path, 120)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not sign URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}

/** Re-files an invoice: `shipment_id` null moves it back under production. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, invoiceId } = await ctx.params
  const body = await req.json() as { shipment_id?: string | null }

  const db = createServerClient()
  const { error } = await db
    .from('inbound_invoices')
    .update({ shipment_id: body.shipment_id || null })
    .eq('id', invoiceId).eq('inbound_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id, invoiceId } = await ctx.params
  const db = createServerClient()

  const { data: row } = await db
    .from('inbound_invoices').select('path')
    .eq('id', invoiceId).eq('inbound_id', id).maybeSingle()

  if (row?.path) await db.storage.from(INVOICE_BUCKET).remove([row.path])

  const { error } = await db
    .from('inbound_invoices').delete().eq('id', invoiceId).eq('inbound_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
