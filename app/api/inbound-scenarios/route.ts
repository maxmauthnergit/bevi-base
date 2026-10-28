import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db
    .from('inbound_scenarios')
    .select('id, name, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenarios: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; payload?: unknown }

  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 422 })
  if (!body.payload)      return NextResponse.json({ error: 'payload is required' }, { status: 422 })

  const db = createServerClient()
  const { data, error } = await db
    .from('inbound_scenarios')
    .insert({ name: body.name.trim(), payload: body.payload })
    .select('id, name, payload, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scenario: data })
}
