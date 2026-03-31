import { metaFetch, getAccountId } from './client'
import type { MetaInsight, MetaInsightsResponse } from './client'
import type { KpiValue } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFloat(s: string | undefined) {
  return parseFloat(s ?? '0') || 0
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getActionValue(
  actions: MetaInsight['actions'],
  type: string
): number {
  const match = actions?.find((a) => a.action_type === type)
  return match ? toFloat(match.value) : 0
}

// Fields we request from every insights call
const INSIGHT_FIELDS = [
  'spend',
  'impressions',
  'clicks',
  'cpm',
  'cpc',
  'reach',
  'purchase_roas',
  'actions',
].join(',')

// ─── Fetch insights for a date range ─────────────────────────────────────────

async function getInsights(
  since: string,
  until: string,
  timeIncrement?: string
): Promise<MetaInsight[]> {
  const account = getAccountId()

  const params: Record<string, string> = {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: 'account',
    limit: '100',   // default page size is 25 — bump to avoid missing recent days
  }
  if (timeIncrement) params.time_increment = timeIncrement

  const data = await metaFetch<MetaInsightsResponse>(
    `/${account}/insights`,
    params,
    { next: { revalidate: 300 } }
  )

  return data.data
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface MetaKPIs {
  kpis: Record<string, KpiValue>
}

export async function getMetaKPIs(): Promise<MetaKPIs> {
  const now      = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0)

  const [currData, prevData] = await Promise.all([
    getInsights(isoDate(thisMonth), isoDate(now)),
    getInsights(isoDate(prevStart), isoDate(prevEnd)),
  ])

  function summarise(rows: MetaInsight[]) {
    return rows.reduce(
      (acc, row) => {
        acc.spend       += toFloat(row.spend)
        acc.impressions += toFloat(row.impressions)
        acc.clicks      += toFloat(row.clicks)
        acc.purchases   += getActionValue(row.actions, 'purchase') ||
                           getActionValue(row.actions, 'omni_purchase')
        // purchase_roas is weighted by spend — take latest row value
        if (row.purchase_roas?.length) {
          acc.roas = toFloat(row.purchase_roas[0].value)
        }
        return acc
      },
      { spend: 0, impressions: 0, clicks: 0, purchases: 0, roas: 0 }
    )
  }

  const curr = summarise(currData)
  const prev = summarise(prevData)

  const cac     = curr.purchases  > 0 ? curr.spend / curr.purchases  : 0
  const cacPrev = prev.purchases  > 0 ? prev.spend / prev.purchases  : 0

  function kpi(
    id: string,
    value: number,
    prevValue: number,
    isPositiveUp: boolean
  ): KpiValue {
    const delta        = Math.round((value - prevValue) * 100) / 100
    const deltaPercent = prevValue !== 0
      ? Math.round((delta / prevValue) * 1000) / 10
      : 0
    return {
      metricId: id,
      value:    Math.round(value * 100) / 100,
      previousValue: Math.round(prevValue * 100) / 100,
      delta,
      deltaPercent,
      trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      isPositiveUp,
    }
  }

  return {
    kpis: {
      ad_spend_mtd: kpi('ad_spend_mtd', curr.spend,  prev.spend,  false),
      roas_mtd:     kpi('roas_mtd',     curr.roas,   prev.roas,   true),
      cac_mtd:      kpi('cac_mtd',      cac,         cacPrev,     false),
    },
  }
}

// ─── 30-day daily spend trend ─────────────────────────────────────────────────

export interface DailySpend {
  date: string
  spend: number
  impressions: number
  clicks: number
  roas: number
}

export async function getDailySpend(): Promise<DailySpend[]> {
  const now  = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  from.setHours(0, 0, 0, 0)

  const rows = await getInsights(isoDate(from), isoDate(now), '1')

  return rows.map((row) => ({
    date:        row.date_start,
    spend:       toFloat(row.spend),
    impressions: toFloat(row.impressions),
    clicks:      toFloat(row.clicks),
    roas:        row.purchase_roas?.length ? toFloat(row.purchase_roas[0].value) : 0,
  }))
}
