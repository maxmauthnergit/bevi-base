import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { INVOICE_BUCKET } from '@/lib/inbounds'
import type { SupabaseClient } from '@supabase/supabase-js'

const COLUMN = {
  production: 'production_invoice_path',
  shipping:   'shipping_invoice_path',
} as const

type Kind = keyof typeof COLUMN

function readKind(req: NextRequest, fallback?: string | null): Kind | null {
  const raw = fallback ?? req.nextUrl.searchParams.get('kind')
  return raw === 'production' || raw === 'shipping' ? raw : null
}

// Buckets are created on demand here, same as the bank-statement routes.
async function ensureBucket(db: SupabaseClient) {
  await db.storage.createBucket(INVOICE_BUCKET, { public: false }).catch(() => {})
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id }   = await ctx.params
  const formData = await req.formData()
  const kind     = readKind(req, formData.get('kind') as string | null)
  const file     = formData.get('file') as File | null

  if (!kind) return NextResponse.json({ error: 'kind must be "production" or "shipping"' }, { status: 422 })
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const db = createServerClient()
  await ensureBucket(db)

  const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
  const path = `${id}/${kind}-${Date.now()}.${ext}`

  const { error: upErr } = await db.storage
    .from(INVOICE_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Replacing an invoice shouldn't leave the previous file behind.
  const { data: row } = await db.from('inbounds').select(COLUMN[kind]).eq('id', id).maybeSingle()
  const previous = (row as Record<string, string | null> | null)?.[COLUMN[kind]]
  if (previous && previous !== path) {
    await db.storage.from(INVOICE_BUCKET).remove([previous])
  }

  const { error } = await db
    .from('inbounds')
    .update({ [COLUMN[kind]]: path, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, path })
}

// Returns a short-lived signed URL, as the WeShip invoice download does.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const kind   = readKind(req)
  if (!kind) return NextResponse.json({ error: 'kind must be "production" or "shipping"' }, { status: 422 })

  const db = createServerClient()
  const { data: row } = await db.from('inbounds').select(COLUMN[kind]).eq('id', id).maybeSingle()
  const path = (row as Record<string, string | null> | null)?.[COLUMN[kind]]
  if (!path) return NextResponse.json({ error: 'No invoice uploaded' }, { status: 404 })

  const { data, error } = await db.storage.from(INVOICE_BUCKET).createSignedUrl(path, 120)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not sign URL' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const kind   = readKind(req)
  if (!kind) return NextResponse.json({ error: 'kind must be "production" or "shipping"' }, { status: 422 })

  const db = createServerClient()
  const { data: row } = await db.from('inbounds').select(COLUMN[kind]).eq('id', id).maybeSingle()
  const path = (row as Record<string, string | null> | null)?.[COLUMN[kind]]
  if (path) await db.storage.from(INVOICE_BUCKET).remove([path])

  const { error } = await db
    .from('inbounds')
    .update({ [COLUMN[kind]]: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
