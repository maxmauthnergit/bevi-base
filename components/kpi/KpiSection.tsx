'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import { KpiCard } from '@/components/kpi/KpiCard'
import type { KpiValue, MetricDefinition } from '@/lib/types'

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
  { id: 'revenue_gross', label: 'Revenue Gross',    source: 'shopify', format: 'currency' },
  { id: 'revenue_net',   label: 'Revenue Net',      source: 'shopify', format: 'currency' },
  { id: 'orders',        label: 'Orders',           source: 'shopify', format: 'number'   },
  { id: 'units_sold',    label: 'Units Sold',       source: 'shopify', format: 'number'   },
  { id: 'meta_spend',    label: 'Meta Ad Spend',    source: 'meta',    format: 'currency' },
  { id: 'aov',           label: 'Avg Order Value',  source: 'shopify', format: 'currency' },
]

interface KpiResponse {
  kpis: Record<string, KpiValue>
  compPeriod: { from: string; to: string }
}

export function KpiSection() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<KpiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  const fromStr = toDateStr(range.from)
  const toStr   = toDateStr(range.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ from: fromStr, to: toStr })
    if (range.preset) params.set('preset', range.preset)
    if (range.month)  params.set('month',  range.month)
    fetch(`/api/kpis?${params}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { setData(json); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [fromStr, toStr, range.preset, range.month])

  const subtitle = data?.compPeriod
    ? fmtCompPeriod(data.compPeriod.from, data.compPeriod.to)
    : 'vs. prev. period'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
      marginBottom: 16,
    }}>
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
            ) : error ? (
              <div className="p-6">
                <span className="label">{metric.label}</span>
                <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#9E9D98' }}>—</div>
              </div>
            ) : (
              <div className="p-6">
                <span className="label">{metric.label}</span>
                <div style={{
                  marginTop: 12, height: 28, borderRadius: 6,
                  backgroundColor: '#F0EFE9', width: '60%',
                }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
