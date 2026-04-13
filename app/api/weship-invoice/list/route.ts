import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const client = createServerClient()
  const { data, error } = await client.storage.from('weship-invoices').list()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const files = data ?? []
  const invoices = files
    .filter(f => f.name.endsWith('.pdf'))
    .map(f => f.name.replace('.pdf', ''))
  const services = files
    .filter(f => f.name.endsWith('-services.xlsx'))
    .map(f => f.name.replace('-services.xlsx', ''))
  return NextResponse.json({ invoices, services })
}
