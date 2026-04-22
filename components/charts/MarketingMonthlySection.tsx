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

function fmtNum(v: number, decimals = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

function monthLabel(m: string) {
  const d = new Date(m + '-15')
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

const DEFAULT_VISIBLE = 5

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

  // Newest first
  const reversed = [...months].reverse()
  const visible  = showAll ? reversed : reversed.slice(0, DEFAULT_VISIBLE)
  const hasMore  = reversed.length > DEFAULT_VISIBLE

  const maxRevenue = Math.max(...months.map(m => m.revenue), 1)
  const maxSpend   = Math.max(...months.map(m => m.spend),   1)
  const maxScale   = Math.max(maxRevenue, maxSpend)
  const maxRoas    = Math.max(...months.map(m => m.blended_roas), 0.01)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Spend vs Revenue + ROAS trend side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Spend vs Revenue */}
        <div style={{ ...CARD, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <span className="label" style={{ display: 'block', marginBottom: 20 }}>Spend vs. Revenue</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(row => (
              <div key={row.month} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="label">{monthLabel(row.month)}</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#DC2626' }}>
                      {fmtEur(row.spend)}
                    </span>
                    <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1FA8A8' }}>
                      {fmtEur(row.revenue)}
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
                  {/* Revenue bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${(row.revenue / maxScale) * 100}%`,
                    backgroundColor: '#1FA8A8', borderRadius: 2, opacity: 0.4,
                  }} />
                  {/* Spend bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${(row.spend / maxScale) * 100}%`,
                    backgroundColor: '#DC2626', borderRadius: 2, opacity: 0.55,
                  }} />
                </div>
              </div>
            ))}
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
              {showAll ? '↑ Show less' : `↓ Show all (${reversed.length})`}
            </button>
          )}
        </div>

        {/* Blended ROAS trend */}
        <div style={{ ...CARD, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <span className="label" style={{ display: 'block', marginBottom: 20 }}>Blended ROAS / Month</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(row => (
              <div key={row.month} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="label">{monthLabel(row.month)}</span>
                  <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#5175B0' }}>
                    {row.blended_roas > 0 ? fmtNum(row.blended_roas, 2) + '×' : '—'}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${(row.blended_roas / maxRoas) * 100}%`,
                    backgroundColor: '#5175B0', borderRadius: 2, opacity: 0.65,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
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
              {showAll ? '↑ Show less' : `↓ Show all (${reversed.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Monthly table */}
      <div style={{ ...CARD, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <span className="label" style={{ display: 'block', marginBottom: 20 }}>Monthly Overview</span>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'Month',         align: 'left'  },
                  { label: 'Ad Spend',      align: 'right' },
                  { label: 'Revenue',       align: 'right' },
                  { label: 'Orders',        align: 'right' },
                  { label: 'Blended ROAS',  align: 'right' },
                  { label: 'Meta ROAS',     align: 'right' },
                  { label: 'CAC',           align: 'right' },
                  { label: 'CPM',           align: 'right' },
                  { label: 'CTR',           align: 'right' },
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
              {reversed.map((row, i) => (
                <tr
                  key={row.month}
                  style={{ borderBottom: i < reversed.length - 1 ? '1px solid #F0EFE9' : 'none' }}
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
