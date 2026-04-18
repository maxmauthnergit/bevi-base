import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServerClient()

  const { data: txns, error } = await db
    .from('bank_transactions')
    .select('date, counterparty, reference, amount_eur')
    .gte('date', '2026-01-01')
    .lte('date', '2026-03-31')
    .order('date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const paypalMeta = (txns ?? []).filter(
    (t: { amount_eur: number; counterparty: string; reference: string }) =>
      t.amount_eur < 0 &&
      t.counterparty.toLowerCase().includes('paypal europe') &&
      /^\d+\/PAYPAL$/.test(t.reference.trim())
  )

  const metaAccount = process.env.META_AD_ACCOUNT_ID?.startsWith('act_')
    ? process.env.META_AD_ACCOUNT_ID
    : `act_${process.env.META_AD_ACCOUNT_ID}`

  const metaUrl = `https://graph.facebook.com/v21.0/${metaAccount}/insights?fields=spend&time_range=${encodeURIComponent(JSON.stringify({ since: '2026-01-01', until: '2026-03-31' }))}&level=account&access_token=${process.env.META_ACCESS_TOKEN}`

  let metaSpend: number | null = null
  let metaError: string | null = null
  try {
    const metaRes = await fetch(metaUrl)
    const metaJson = await metaRes.json()
    metaSpend = metaJson?.data?.[0]?.spend ? parseFloat(metaJson.data[0].spend) : null
    if (!metaRes.ok) metaError = JSON.stringify(metaJson)
  } catch (e) {
    metaError = (e as Error).message
  }

  const paypalTotal = paypalMeta.reduce((s: number, t: { amount_eur: number }) => s + Math.abs(t.amount_eur), 0)

  return NextResponse.json({
    period: '2026-01-01 to 2026-03-31',
    meta_api_spend_eur: metaSpend,
    meta_api_error: metaError,
    paypal_transactions: paypalMeta,
    paypal_count: paypalMeta.length,
    paypal_total_eur: Math.round(paypalTotal * 100) / 100,
    difference_eur: metaSpend !== null ? Math.round((metaSpend - paypalTotal) * 100) / 100 : null,
  })
}
