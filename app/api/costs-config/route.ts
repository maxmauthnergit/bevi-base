import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_PRODUCT_COSTS, applyOverrides } from '@/lib/costs-config'

const CONFIG_PATH = 'config/production-costs.json'

export async function GET() {
  const client = createServerClient()
  const { data, error } = await client.storage
    .from('weship-invoices')
    .download(CONFIG_PATH)

  if (error || !data) {
    return NextResponse.json({ costs: DEFAULT_PRODUCT_COSTS })
  }

  try {
    const text      = await data.text()
    const overrides = JSON.parse(text) as Record<string, Record<string, number>>
    return NextResponse.json({ costs: applyOverrides(overrides) })
  } catch {
    return NextResponse.json({ costs: DEFAULT_PRODUCT_COSTS })
  }
}

export async function POST(req: NextRequest) {
  const overrides = await req.json() as Record<string, Record<string, number>>
  const bytes     = new TextEncoder().encode(JSON.stringify(overrides))
  const client    = createServerClient()

  const { error } = await client.storage
    .from('weship-invoices')
    .upload(CONFIG_PATH, bytes, { contentType: 'application/json', upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
