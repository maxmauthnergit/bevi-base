'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface ProductRow { title: string; variant: string | null; revenue: number }
interface MarketRow  { country: string; revenue: number }

interface BreakdownData {
  by_product: ProductRow[]
  by_market:  MarketRow[]
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  border: '1px solid #E3E2DC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 24,
}

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function BarRow({
  label,
  sublabel,
  revenue,
  maxRevenue,
  color,
}: {
  label: string
  sublabel?: string | null
  revenue: number
  maxRevenue: number
  color: string
}) {
  const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="label" style={{ flexShrink: 1, minWidth: 0 }}>
          {label}
          {sublabel && (
            <span style={{ color: '#C7C6C0', marginLeft: 4 }}>{sublabel}</span>
          )}
        </span>
        <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color, flexShrink: 0 }}>
          {fmtEur(revenue)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0,
          height: '100%', width: `${pct}%`,
          backgroundColor: color, borderRadius: 2, opacity: 0.65,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={CARD}>
      <span className="label" style={{ display: 'block', marginBottom: 20 }}>{title}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

export function SalesBreakdownSection() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)

  const fromStr = toDateStr(range.from)
  const toStr   = toDateStr(range.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/sales/breakdown?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fromStr, toStr])

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <div style={{ ...CARD, height: 300 }} />
        <div style={{ ...CARD, height: 300 }} />
      </div>
    )
  }

  const maxProduct = Math.max(...data.by_product.map(r => r.revenue), 1)
  const maxMarket  = Math.max(...data.by_market.map(r => r.revenue),  1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <BreakdownCard title="Revenue by Product">
        {data.by_product.map((row, i) => (
          <BarRow
            key={i}
            label={row.title}
            sublabel={row.variant}
            revenue={row.revenue}
            maxRevenue={maxProduct}
            color="#1FA8A8"
          />
        ))}
      </BreakdownCard>

      <BreakdownCard title="Revenue by Market">
        {data.by_market.map((row, i) => (
          <BarRow
            key={i}
            label={row.country}
            revenue={row.revenue}
            maxRevenue={maxMarket}
            color="#5175B0"
          />
        ))}
      </BreakdownCard>
    </div>
  )
}
