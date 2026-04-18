import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const BUCKET = 'bank-statements'

async function ensureBucket(db: ReturnType<typeof createServerClient>) {
  await db.storage.createBucket(BUCKET, { public: false }).catch(() => {})
}

export async function GET() {
  const db = createServerClient()
  await ensureBucket(db)

  const { data, error } = await db.storage.from(BUCKET).list()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filename convention: {statement_month}_{date_from}_{date_to}.pdf
  // e.g. 2026-03_2024-01-15_2026-03-31.pdf
  const pdfs = (data ?? [])
    .filter(f => f.name.endsWith('.pdf'))
    .map(f => {
      const name  = f.name.replace('.pdf', '')
      const parts = name.split('_')
      return {
        filename:        f.name,
        statement_month: parts[0] ?? null,
        date_from:       parts[1] ?? null,
        date_to:         parts[2] ?? null,
        uploaded_at:     (f as { created_at?: string }).created_at ?? null,
      }
    })
    .sort((a, b) => (b.statement_month ?? '').localeCompare(a.statement_month ?? ''))

  return NextResponse.json({ pdfs })
}

export async function DELETE(req: NextRequest) {
  const filename       = req.nextUrl.searchParams.get('filename')
  const from           = req.nextUrl.searchParams.get('from')
  const to             = req.nextUrl.searchParams.get('to')
  const statementMonth = req.nextUrl.searchParams.get('statement_month')

  const db = createServerClient()

  if (filename) {
    await db.storage.from(BUCKET).remove([filename])
  }

  let txQuery = db.from('bank_transactions').delete()
  if (from && to)   txQuery = txQuery.gte('date', from).lte('date', to)
  else if (from)    txQuery = txQuery.gte('date', from)
  else if (to)      txQuery = txQuery.lte('date', to)
  else              txQuery = txQuery.not('id', 'is', null)

  const { error: txErr } = await txQuery
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  if (statementMonth) {
    await db.from('bank_balance_snapshots').delete().eq('statement_month', statementMonth)
  }

  return NextResponse.json({ ok: true })
}
