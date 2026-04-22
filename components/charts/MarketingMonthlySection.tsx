'use client'

import { useEffect, useState } from 'react'

interface MonthRow {
  month:        string
  spend:        number
  revenue:      number
  orders:       number
  blended_roas: number
  meta_roas:    number
  cac:          number
  impressions:  number
  ctr:          number
  cpm:          number
}

type RowItem =
  | { type: 'year'; year: number }
  | { type: 'data'; data: MonthRow }

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  border: '1px solid #E3E2DC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 24,
}

const DEFAULT_VISIBLE = 5

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function fmtNum(v: number, decimals = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function buildRows(data: MonthRow[]): RowItem[] {
  const reversed = [...data].reverse()
  const rows: RowItem[] = []
  let lastYear: number | null = null
  for (const d of reversed) {
    const year = parseInt(d.month.slice(0, 4), 10)
    if (year !== lastYear) {
      if (lastYear !== null) rows.push({ type: 'year', year })
      lastYear = year
    }
    rows.push({ type: 'data', data: d })
  }
  return rows
}

function trimRows(rows: RowItem[], max: number): RowItem[] {
  const result: RowItem[] = []
  let dataCount = 0
  for (const row of rows) {
    if (row.type === 'data') {
      if (dataCount >= max) break
      dataCount++
    }
    result.push(row)
  }
  return result
}

export function MarketingMonthlySection() {
  const [months,  setMonths]  = useState<MonthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/marketing/monthly')
      .then(r => r.json())
      .then(d => { setMonths(d.months ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ ...CARD, height: 240, opacity: 0.4 }} />
  }

  const allRows  = buildRows(months)
  const rows     = showAll ? allRows : trimRows(allRows, DEFAULT_VISIBLE)
  const hasMore  = months.length > DEFAULT_VISIBLE

  const maxScale = Math.max(...months.map(m => Math.max(m.revenue, m.spend)), 1)
  const maxRoas  = Math.max(...months.map(m => m.blended_roas), 0.01)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Combined Spend vs Revenue + Blended ROAS card */}
      <div style={CARD}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 20 }}>
          <span className="label">Spend vs. Revenue</span>
          <span className="label">Blended ROAS / Month</span>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(row => {
            if (row.type === 'year') {
              return (
                <div key={`y-${row.year}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                  <span className="label" style={{ color: '#C7C6C0', flexShrink: 0 }}>{row.year}</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#E3E2DC' }} />
                </div>
              )
            }

            const d = row.data
            return (
              <div key={d.month} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                {/* Spend vs Revenue */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="label">{monthLabel(d.month)}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#DC2626' }}>
                        {d.spend > 0 ? fmtEur(d.spend) : '—'}
                      </span>
                      <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1FA8A8' }}>
                        {d.revenue > 0 ? fmtEur(d.revenue) : '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${(d.revenue / maxScale) * 100}%`,
                      backgroundColor: '#1FA8A8', borderRadius: 2, opacity: 0.4,
                    }} />
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${(d.spend / maxScale) * 100}%`,
                      backgroundColor: '#DC2626', borderRadius: 2, opacity: 0.55,
                    }} />
                  </div>
                </div>

                {/* Blended ROAS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="label">{monthLabel(d.month)}</span>
                    <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#5175B0' }}>
                      {d.blended_roas > 0 ? fmtNum(d.blended_roas, 2) + '×' : '—'}
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${(d.blended_roas / maxRoas) * 100}%`,
                      backgroundColor: '#5175B0', borderRadius: 2, opacity: 0.65,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 3, backgroundColor: '#1FA8A8', opacity: 0.4, borderRadius: 1 }} />
            <span className="label" style={{ color: '#9E9D98' }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 3, backgroundColor: '#DC2626', opacity: 0.55, borderRadius: 1 }} />
            <span className="label" style={{ color: '#9E9D98' }}>Spend</span>
          </div>
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
            {showAll ? '↑ Show less' : `↓ Show all (${months.length} months)`}
          </button>
        )}
      </div>

      {/* Monthly table */}
      <div style={CARD}>
        <span className="label" style={{ display: 'block', marginBottom: 20 }}>Monthly Overview</span>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'Month',        align: 'left'  },
                  { label: 'Ad Spend',     align: 'right' },
                  { label: 'Revenue',      align: 'right' },
                  { label: 'Orders',       align: 'right' },
                  { label: 'Blended ROAS', align: 'right' },
                  { label: 'Meta ROAS',    align: 'right' },
                  { label: 'CAC',          align: 'right' },
                  { label: 'CPM',          align: 'right' },
                  { label: 'CTR',          align: 'right' },
                ].map(h => (
                  <th
                    key={h.label}
                    className="label"
                    style={{
                      textAlign: h.align as 'left' | 'right',
                      paddingBottom: 10,
                      paddingRight: h.align === 'right' ? 0 : 16,
                      borderBottom: '1px solid #E3E2DC',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((row, i, arr) => (
                <tr
                  key={row.month}
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid #F0EFE9' : 'none' }}
                >
                  <td className="label" style={{ padding: '10px 16px 10px 0', color: '#6B6A64', whiteSpace: 'nowrap' }}>
                    {monthLabel(row.month)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#DC2626' }}>
                    {row.spend > 0 ? fmtEur(row.spend) : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#1FA8A8' }}>
                    {row.revenue > 0 ? fmtEur(row.revenue) : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#6B6A64' }}>
                    {row.orders > 0 ? fmtNum(row.orders) : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#5175B0', fontWeight: 600 }}>
                    {row.blended_roas > 0 ? fmtNum(row.blended_roas, 2) + '×' : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9E9D98' }}>
                    {row.meta_roas > 0 ? fmtNum(row.meta_roas, 2) + '×' : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9E9D98' }}>
                    {row.cac > 0 ? fmtEur(row.cac) : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9E9D98' }}>
                    {row.cpm > 0 ? fmtEur(row.cpm) : '—'}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9E9D98' }}>
                    {row.ctr > 0 ? fmtNum(row.ctr, 2) + ' %' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
