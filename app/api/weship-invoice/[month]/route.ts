import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET — returns a short-lived signed download URL
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ month: string }> }
) {
  const { month } = await ctx.params
  const client = createServerClient()

  const { data, error } = await client.storage
    .from('weship-invoices')
    .createSignedUrl(`${month}.pdf`, 120) // valid 2 min

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

// DELETE — removes the file for a given month
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ month: string }> }
) {
  const { month } = await ctx.params
  const client = createServerClient()

  const { error } = await client.storage
    .from('weship-invoices')
    .remove([`${month}.pdf`])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
