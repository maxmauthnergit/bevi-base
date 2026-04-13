import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

function filePath(month: string, type: string) {
  return type === 'services' ? `${month}-services.xlsx` : `${month}.pdf`
}

// GET — returns a short-lived signed download URL
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ month: string }> }
) {
  const { month } = await ctx.params
  const type      = req.nextUrl.searchParams.get('type') ?? 'invoice'
  const client    = createServerClient()

  const { data, error } = await client.storage
    .from('weship-invoices')
    .createSignedUrl(filePath(month, type), 120) // valid 2 min

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

// DELETE — removes the file for a given month + type
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ month: string }> }
) {
  const { month } = await ctx.params
  const type      = req.nextUrl.searchParams.get('type') ?? 'invoice'
  const client    = createServerClient()

  const { error } = await client.storage
    .from('weship-invoices')
    .remove([filePath(month, type)])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
