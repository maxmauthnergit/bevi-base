import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body   = await req.json() as { name?: string; payload?: unknown }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name?.trim()) patch.name = body.name.trim()
  if (body.payload)      patch.payload = body.payload

  const db = createServerClient()
  const { error } = await db.from('inbound_scenarios').update(patch).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const db     = createServerClient()

  const { error } = await db.from('inbound_scenarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
