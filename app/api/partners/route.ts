import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const COLS = 'id, name, is_supplier, is_shipping'

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db.from('partners').select(COLS).order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ partners: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; is_supplier?: boolean; is_shipping?: boolean }
  const name = body.name?.trim()

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 422 })

  const db = createServerClient()

  // The same company can be both a supplier and a forwarder, so adding an
  // existing name in the other role widens the flags instead of failing.
  const { data: existing } = await db
    .from('partners').select(COLS).eq('name', name).maybeSingle()

  if (existing) {
    const patch = {
      is_supplier: existing.is_supplier || !!body.is_supplier,
      is_shipping: existing.is_shipping || !!body.is_shipping,
    }
    const { data, error } = await db
      .from('partners').update(patch).eq('id', existing.id).select(COLS).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, partner: data })
  }

  const { data, error } = await db
    .from('partners')
    .insert({ name, is_supplier: !!body.is_supplier, is_shipping: !!body.is_shipping })
    .select(COLS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, partner: data })
}
