import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { INVOICE_BUCKET } from '@/lib/inbounds'

const COLS = 'id, shipment_id, filename, content_type, size_bytes, uploaded_at'

// Buckets are created on demand here, same as the bank-statement routes.
async function ensureBucket(db: SupabaseClient) {
  await db.storage.createBucket(INVOICE_BUCKET, { public: false }).catch(() => {})
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const db     = createServerClient()

  const { data, error } = await db
    .from('inbound_invoices').select(COLS).eq('inbound_id', id).order('uploaded_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data ?? [] })
}

/**
 * Uploads one or more files. `shipment_id` files the invoice under that
 * shipment; leaving it out files it under production.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id }   = await ctx.params
  const formData = await req.formData()

  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const rawShipment = formData.get('shipment_id')
  const shipmentId  = typeof rawShipment === 'string' && rawShipment ? rawShipment : null

  const db = createServerClient()
  await ensureBucket(db)

  const created = []
  for (const file of files) {
    const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
    const path = `${id}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await db.storage
      .from(INVOICE_BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data, error } = await db
      .from('inbound_invoices')
      .insert({
        inbound_id:   id,
        shipment_id:  shipmentId,
        path,
        filename:     file.name,
        content_type: file.type || null,
        size_bytes:   file.size,
      })
      .select(COLS)
      .single()

    if (error) {
      // Don't leave the object behind if its row could not be written.
      await db.storage.from(INVOICE_BUCKET).remove([path])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    created.push(data)
  }

  return NextResponse.json({ ok: true, invoices: created })
}
