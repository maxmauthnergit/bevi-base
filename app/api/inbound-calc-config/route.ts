import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_CALC_CONFIG, type CalcConfig } from '@/lib/inbound-calc'

const KEY = 'inbound_calc'

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db
    .from('app_config')
    .select('value')
    .eq('key', KEY)
    .maybeSingle()

  // A missing row (or a missing table, before the SQL has been run) simply
  // means "no overrides yet" — the calculator stays usable on the defaults.
  if (error || !data) return NextResponse.json({ config: DEFAULT_CALC_CONFIG })

  const stored = data.value as Partial<CalcConfig>
  return NextResponse.json({
    config: {
      ...DEFAULT_CALC_CONFIG,
      ...stored,
      modes: { ...DEFAULT_CALC_CONFIG.modes, ...(stored.modes ?? {}) },
    },
  })
}

export async function POST(req: NextRequest) {
  const config = await req.json() as CalcConfig
  const db     = createServerClient()

  const { error } = await db
    .from('app_config')
    .upsert({ key: KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
