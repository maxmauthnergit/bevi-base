'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface HourRow { hour: number; label: string; orders: number }
interface DayRow  { day: number; label: string;  orders: number }

interface PeakData {
  by_hour: HourRow[]
  by_day:  DayRow[]
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  border: '1px solid #E3E2DC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 24,
}

// How many rows to show before "Show all"
const DEFAULT_VISIBLE_HOURS = 8
const DEFAULT_VISIBLE_DAYS  = 7   // only 7 days total — always show all

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%',
        width: `${pct}%`, backgroundColor: color, borderRadius: 2, opacity: 0.65,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function PeakCard<T extends { label: string; orders: number }>({
  title,
  rows,
  color,
  defaultVisible,
}: {
  title: string
  rows: T[]
  color: string
  defaultVisible: number
}) {
  const [showAll, setShowAll] = useState(false)
  const maxOrders = Math.max(...rows.map(r => r.orders), 1)
  const visible   = showAll ? rows : rows.slice(0, defaultVisible)
  const hasMore   = rows.length > defaultVisible

  return (
    <div style={CARD}>
      <span className="label" style={{ display: 'block', marginBottom: 20 }}>{title}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(row => (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="label">{row.label}</span>
              <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color }}>
                {row.orders}
              </span>
            </div>
            <Bar pct={(row.orders / maxOrders) * 100} color={color} />
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            display: 'block', marginTop: 16,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
            fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#9E9D98',
          }}
        >
          {showAll ? '↑ Show less' : `↓ Show all (${rows.length})`}
        </button>
      )}
    </div>
  )
}

export function SalesPeakTimes() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<PeakData | null>(null)
  const [loading, setLoading] = useState(true)

  const fromStr = toDateStr(range.from)
  const toStr   = toDateStr(range.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/sales/peak-times?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fromStr, toStr])

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <div style={{ ...CARD, height: 260 }} />
        <div style={{ ...CARD, height: 260 }} />
      </div>
    )
  }

  // Filter out hours with 0 orders — only show active hours
  const activeHours = data.by_hour.filter(r => r.orders > 0)
  const activeDays  = data.by_day.filter(r => r.orders > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <PeakCard
        title="Peak Hours"
        rows={activeHours}
        color="#BF6035"
        defaultVisible={DEFAULT_VISIBLE_HOURS}
      />
      <PeakCard
        title="Peak Days"
        rows={activeDays}
        color="#5175B0"
        defaultVisible={DEFAULT_VISIBLE_DAYS}
      />
    </div>
  )
}
