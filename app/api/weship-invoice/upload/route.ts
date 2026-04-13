import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file  = formData.get('file')  as File   | null
  const month = formData.get('month') as string | null
  const type  = (formData.get('type') as string | null) ?? 'invoice'

  if (!file || !month) {
    return NextResponse.json({ error: 'Missing file or month' }, { status: 400 })
  }

  const isServices = type === 'services'
  const path        = isServices ? `${month}-services.xlsx` : `${month}.pdf`
  const contentType = isServices
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf'

  const bytes  = await file.arrayBuffer()
  const client = createServerClient()

  const { error } = await client.storage
    .from('weship-invoices')
    .upload(path, bytes, { contentType, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
