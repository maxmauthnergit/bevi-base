import { NextResponse } from 'next/server'
import { metaFetch, getAccountId } from '@/lib/meta/client'
import type { MetaInsightsResponse } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}
  const errors: Record<string, string>   = {}

  // 1. Account info
  try {
    const account = getAccountId()
    const data = await metaFetch<{
      id: string
      name: string
      currency: string
      account_status: number
    }>(`/${account}`, { fields: 'id,name,currency,account_status' })

    results.account = {
      id:       data.id,
      name:     data.name,
      currency: data.currency,
      status:   data.account_status === 1 ? 'active' : `status_${data.account_status}`,
    }
  } catch (e) {
    errors.account = String(e)
  }

  // 2. This month's spend + ROAS
  try {
    const account = getAccountId()
    const now   = new Date()
    const since = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]
    const until = now.toISOString().split('T')[0]

    const data = await metaFetch<MetaInsightsResponse>(
      `/${account}/insights`,
      {
        fields: 'spend,impressions,clicks,purchase_roas,actions',
        time_range: JSON.stringify({ since, until }),
        level: 'account',
      }
    )

    if (data.data.length > 0) {
      const row = data.data[0]
      const purchases = row.actions?.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      )
      results.this_month = {
        spend:       row.spend,
        impressions: row.impressions,
        clicks:      row.clicks,
        roas:        row.purchase_roas?.[0]?.value ?? 'n/a',
        purchases:   purchases?.value ?? '0',
        period:      `${since} → ${until}`,
      }
    } else {
      results.this_month = { note: 'No data returned for this period' }
    }
  } catch (e) {
    errors.insights = String(e)
  }

  const ok = Object.keys(errors).length === 0

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    },
    { status: ok ? 200 : 500 }
  )
}
