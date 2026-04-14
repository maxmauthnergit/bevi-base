// Diagnostic endpoint — visit /api/storage-diag to test Supabase storage access.
// Remove this file once the XLSX integration is confirmed working.

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  const client = createServerClient()

  // 1. List the bucket
  const { data: listed, error: listErr } = await client.storage
    .from('weship-invoices')
    .list()

  if (listErr) {
    return NextResponse.json({
      hasServiceKey,
      listError: listErr.message,
      files: null,
      signTest: null,
    })
  }

  const files = listed?.map(f => f.name) ?? []

  // 2. Try createSignedUrl on the first xlsx found
  const firstXlsx = listed?.find(f => f.name.endsWith('.xlsx'))
  let signTest: { file: string; ok: boolean; error?: string; url?: string } | null = null

  if (firstXlsx) {
    const { data: signed, error: signErr } = await client.storage
      .from('weship-invoices')
      .createSignedUrl(firstXlsx.name, 30)

    signTest = signErr
      ? { file: firstXlsx.name, ok: false, error: signErr.message }
      : { file: firstXlsx.name, ok: true, url: signed!.signedUrl.slice(0, 80) + '…' }
  }

  return NextResponse.json({ hasServiceKey, listError: null, files, signTest })
}
