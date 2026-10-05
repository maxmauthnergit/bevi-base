'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import { KpiCard } from '@/components/kpi/KpiCard'
import { ContributionWaterfall, type WaterfallData } from '@/components/kpi/ContributionWaterfall'
import type { KpiValue, MetricDefinition } from '@/lib/types'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtCompPeriod(from: string, to: string) {
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to   + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (f.getFullYear() !== t.getFullYear()) opts.year = 'numeric'
  const fStr = f.toLocaleDateString('en-GB', opts)
  if (from === to) return `vs. ${fStr}`
  return `vs. ${fStr} – ${t.toLocaleDateString('en-GB', opts)}`
}

const METRICS: MetricDefinition[] = [
  { id: 'net_revenue',      label: 'Net Revenue',                    source: 'shopify', format: 'currency' },
  { id: 'aov',              label: 'Avg Order Value',                source: 'derived', format: 'currency' },
  { id: 'ad_spend',         label: 'Ad Spend',                       source: 'meta',    format: 'currency' },
  { id: 'meta_roas',        label: 'ROAS (Meta-reported)',           source: 'meta',    format: 'number'   },
  { id: 'mer',              label: 'MER',                            source: 'derived', format: 'number'   },
  { id: 'ncac',             label: 'nCAC',                           source: 'derived', format: 'currency' },
  { id: 'contribution',     label: 'Contribution',                   source: 'derived', format: 'currency' },
  { id: 'contribution_pct', label: 'Contribution Margin',            source: 'derived', format: 'percent'  },
  { id: 'foc_to_ncac',      label: 'First-Order Contribution : nCAC', source: 'derived', format: 'number'  },
]

interface Response {
  kpis:       Record<string, KpiValue>
  waterfall:  WaterfallData
  compPeriod: { from: string; to: string } | null
  sources:    {
    revenue: 'shopifyql' | 'orders'; meta: boolean; lots: number; unmappedUnits: number
    history: 'snapshot' | 'live'; synced: number
  }
}

export function UnitEconomicsSection() {
  const { range } = useDateRange()
  const params = new URLSearchParams({ from: toDateStr(range.from), to: toDateStr(range.to) })
  if (range.preset) params.set('preset', range.preset)
  if (range.month)  params.set('month',  range.month)
  const query = params.toString()

  // Results are keyed by the query they answer, so a range change shows the
  // previous numbers dimmed until the new ones land.
  const [result, setResult] = useState<{ query: string; data: Response | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/marketing/unit-economics?${query}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(json => { if (!cancelled) setResult({ query, data: json }) })
      .catch(()  => { if (!cancelled) setResult({ query, data: null }) })
    return () => { cancelled = true }
  }, [query])

  const loading = result?.query !== query
  const data    = result?.data ?? null
  const error   = !loading && data === null

  const subtitle = data?.compPeriod
    ? fmtCompPeriod(data.compPeriod.from, data.compPeriod.to)
    : 'vs. prev. period'

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {METRICS.map(metric => {
          const kpi = data?.kpis[metric.id]
          return (
            <div
              key={metric.id}
              style={{
                position: 'relative', borderRadius: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #E3E2DC',
                opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s',
              }}
            >
              {kpi ? (
                <KpiCard metric={metric} data={kpi} subtitle={subtitle} />
              ) : (
                <div className="p-6" style={{ backgroundColor: '#FFFFFF', borderRadius: 16 }}>
                  <span className="label">{metric.label}</span>
                  {error ? (
                    <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#9E9D98' }}>—</div>
                  ) : (
                    <div style={{ marginTop: 12, height: 28, borderRadius: 6, backgroundColor: '#F0EFE9', width: '60%' }} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ContributionWaterfall data={data?.waterfall ?? null} loading={loading} error={error} />

      {data && (
        <div style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 8, lineHeight: 1.6 }}>
          Revenue: {data.sources.revenue === 'shopifyql' ? 'Shopify Analytics (ShopifyQL)' : 'calculated from orders'}
          {' · '}COGS: FIFO over {data.sources.lots} inbound lots
          {data.sources.unmappedUnits > 0 && ` · ${data.sources.unmappedUnits} sold units without a matching product`}
          {' · '}History: {data.sources.history === 'snapshot' ? 'Supabase snapshot' : 'live from Shopify (snapshot not set up)'}
          {!data.sources.meta && ' · Meta Ads unavailable'}
        </div>
      )}
    </>
  )
}
