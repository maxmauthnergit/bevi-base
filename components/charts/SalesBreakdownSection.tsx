'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { MetricToggle, type SalesMetric } from '@/components/ui/MetricToggle'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface ProductRow { title: string; variant: string | null; revenue: number; orders: number }
interface MarketRow  { country: string; revenue: number; orders: number }

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

function fmtOrders(v: number) {
  return `${v} ${v === 1 ? 'order' : 'orders'}`
}

function BarRow({
  label,
  sublabel,
  revenue,
  orders,
  metric,
  max,
  color,
}: {
  label: string
  sublabel?: string | null
  revenue: number
  orders: number
  metric: SalesMetric
  max: number
  color: string
}) {
  // The selected metric drives the bar and the emphasised number; the other one
  // stays visible in muted text so switching never hides information.
  const primaryValue = metric === 'revenue' ? revenue : orders
  const primaryText  = metric === 'revenue' ? fmtEur(revenue) : String(orders)
  const secondaryText = metric === 'revenue' ? fmtOrders(orders) : fmtEur(revenue)
  const pct = max > 0 ? (primaryValue / max) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="label" style={{ flexShrink: 1, minWidth: 0 }}>
          {label}
          {sublabel && (
            <span style={{ color: '#C7C6C0', marginLeft: 4 }}>{sublabel}</span>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
          <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color }}>
            {primaryText}
          </span>
          <span className="label" style={{ fontSize: '0.625rem', color: '#9E9D98' }}>
            {secondaryText}
          </span>
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
  metric,
  onMetricChange,
  children,
}: {
  title: string
  metric: SalesMetric
  onMetricChange: (m: SalesMetric) => void
  children: React.ReactNode
}) {
  return (
    <div style={CARD}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 20,
      }}>
        <span className="label">{title}</span>
        <MetricToggle value={metric} onChange={onMetricChange} />
      </div>
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

  // Each card keeps its own metric, so one can show revenue while the other
  // shows order counts.
  const [productMetric, setProductMetric] = useState<SalesMetric>('revenue')
  const [marketMetric,  setMarketMetric]  = useState<SalesMetric>('revenue')

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height={300} lines={5} />
        <SkeletonCard height={300} lines={5} />
      </div>
    )
  }

  const maxOf = <T,>(rows: T[], pick: (r: T) => number) => Math.max(...rows.map(pick), 1)

  const maxProduct = maxOf(data.by_product, r => productMetric === 'revenue' ? r.revenue : r.orders)
  const maxMarket  = maxOf(data.by_market,  r => marketMetric  === 'revenue' ? r.revenue : r.orders)

  // Re-sort by whatever is being shown, so the longest bar is always on top.
  const products = [...data.by_product].sort((a, b) =>
    productMetric === 'revenue' ? b.revenue - a.revenue : b.orders - a.orders)
  const markets = [...data.by_market].sort((a, b) =>
    marketMetric === 'revenue' ? b.revenue - a.revenue : b.orders - a.orders)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: 'start' }}>
      <BreakdownCard title="Sales by Product" metric={productMetric} onMetricChange={setProductMetric}>
        {products.map((row, i) => (
          <BarRow
            key={i}
            label={row.title}
            sublabel={row.variant}
            revenue={row.revenue}
            orders={row.orders}
            metric={productMetric}
            max={maxProduct}
            color="#1FA8A8"
          />
        ))}
      </BreakdownCard>

      <BreakdownCard title="Sales by Market" metric={marketMetric} onMetricChange={setMarketMetric}>
        {markets.map((row, i) => (
          <BarRow
            key={i}
            label={row.country}
            revenue={row.revenue}
            orders={row.orders}
            metric={marketMetric}
            max={maxMarket}
            color="#5175B0"
          />
        ))}
      </BreakdownCard>
    </div>
  )
}
