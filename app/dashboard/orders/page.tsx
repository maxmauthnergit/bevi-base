'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import type { OrderRow } from '@/lib/types'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December']

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v) + ' €'
}

function marginColor(m: number) {
  if (m >= 50) return '#0D8585'
  if (m >= 25) return '#B45309'
  return '#DC2626'
}

function marginBg(m: number) {
  if (m >= 50) return 'rgba(13,133,133,0.07)'
  if (m >= 25) return 'rgba(180,83,9,0.07)'
  return 'rgba(220,38,38,0.07)'
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    paid:           { label: 'Paid',      color: '#0D8585', bg: 'rgba(13,133,133,0.08)' },
    refunded:       { label: 'Refunded',  color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    partially_refunded: { label: 'Part. refunded', color: '#B45309', bg: 'rgba(180,83,9,0.08)' },
    pending:        { label: 'Pending',   color: '#6B6A64', bg: 'rgba(107,106,100,0.08)' },
  }
  const s = map[status] ?? { label: status, color: '#9E9D98', bg: '#F5F4F0' }
  return (
    <span style={{
      fontFamily: G, fontSize: '0.625rem', letterSpacing: '0.04em',
      color: s.color, backgroundColor: s.bg,
      padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' as const,
    }}>
      {s.label}
    </span>
  )
}

const thBase: React.CSSProperties = {
  fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
  letterSpacing: '0.07em', color: '#9E9D98', textTransform: 'uppercase',
  whiteSpace: 'nowrap', paddingBottom: 8, borderBottom: '1px solid #E3E2DC',
  textAlign: 'right',
}

const groupTh: React.CSSProperties = {
  fontFamily: G, fontSize: '0.5625rem', fontWeight: 500,
  letterSpacing: '0.08em', color: '#C7C6C0', textTransform: 'uppercase',
  paddingBottom: 4, borderBottom: 'none', textAlign: 'center',
}

export default function OrdersPage() {
  const today = new Date()
  const [year,  setYear]   = useState(today.getFullYear())
  const [month, setMonth]  = useState(today.getMonth() + 1)
  const [orders, setOrders]   = useState<OrderRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const m = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/orders?month=${m}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setOrders(d.orders)
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (year === today.getFullYear() && month === today.getMonth() + 1) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  // Month-level totals
  const totals = orders?.length
    ? {
        gross: orders.reduce((s, o) => s + o.revenue_gross, 0),
        net:   orders.reduce((s, o) => s + o.revenue_net,   0),
        prod:  orders.reduce((s, o) => s + o.cost_production, 0),
        ws:    orders.reduce((s, o) => s + o.cost_weship,   0),
        ship:  orders.reduce((s, o) => s + o.cost_shipping, 0),
        pay:   orders.reduce((s, o) => s + o.cost_payment,  0),
        total: orders.reduce((s, o) => s + o.cost_total,    0),
      }
    : null
  const totalMargin = totals && totals.net > 0
    ? ((totals.net - totals.total) / totals.net) * 100
    : null

  const navBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #E3E2DC', borderRadius: 8,
    padding: '5px 12px', cursor: 'pointer', fontFamily: G,
    fontSize: '0.875rem', color: '#6B6A64', lineHeight: 1,
  }

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1600 }}>
      {/* Page header */}
      <div className="mb-8" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: G, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: 0 }}>
          Orders
        </h1>
        {/* Month switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', minWidth: 130, textAlign: 'center' }}>
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            style={{ ...navBtn, color: isCurrentMonth ? '#D1D0CA' : '#6B6A64', cursor: isCurrentMonth ? 'default' : 'pointer' }}
          >›</button>
        </div>
      </div>

      <Card>
        <CardHeader
          label={`Order List`}
          action={
            orders && !loading
              ? <span className="label" style={{ color: '#9E9D98' }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
              : undefined
          }
        />
        <div style={{ height: 12 }} />

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9E9D98', fontFamily: G, fontSize: '0.875rem' }}>
            Loading…
          </div>
        ) : error ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#DC2626', fontFamily: G, fontSize: '0.875rem' }}>
            {error}
          </div>
        ) : !orders?.length ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9E9D98', fontFamily: G, fontSize: '0.875rem' }}>
            No orders in {MONTHS[month - 1]} {year}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                {/* Group labels */}
                <tr>
                  <th colSpan={2} style={{ ...groupTh, textAlign: 'left', paddingBottom: 2 }} />
                  <th colSpan={2} style={{ ...groupTh, borderBottom: '1px solid #F0EFE9', paddingBottom: 4 }}>
                    Umsatz
                  </th>
                  <th colSpan={4} style={{ ...groupTh, borderBottom: '1px solid #F0EFE9', paddingBottom: 4 }}>
                    Kosten
                  </th>
                  <th style={{ ...groupTh, paddingBottom: 2 }} />
                </tr>
                {/* Column headers */}
                <tr>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 24, minWidth: 80 }}>Order</th>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 32, minWidth: 160 }}>Produkt</th>
                  <th style={{ ...thBase, paddingRight: 20, minWidth: 80 }}>Brutto</th>
                  <th style={{ ...thBase, paddingRight: 32, minWidth: 80 }}>Netto</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 90 }}>Produktion</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 82 }}>WeShip var.</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 74 }}>Shipping</th>
                  <th style={{ ...thBase, paddingRight: 32, minWidth: 88 }}>Payment Fee</th>
                  <th style={{ ...thBase, minWidth: 64 }}>Marge</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((o, i) => {
                  const date = new Date(o.created_at)
                  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  const isLast = i === orders.length - 1
                  const rowStyle: React.CSSProperties = {
                    borderBottom: !isLast ? '1px solid #F0EFE9' : 'none',
                  }
                  const td: React.CSSProperties = {
                    padding: '11px 0', verticalAlign: 'middle',
                  }

                  return (
                    <tr key={o.id} style={rowStyle}>
                      {/* Order ID + date */}
                      <td style={{ ...td, paddingRight: 24 }}>
                        <span style={{ fontFamily: G, color: '#111110', display: 'block' }}>
                          {o.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span className="label" style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>{dateStr}</span>
                          {statusBadge(o.financial_status)}
                        </span>
                      </td>

                      {/* Products */}
                      <td style={{ ...td, paddingRight: 32 }}>
                        {o.items.map((item, j) => (
                          <span
                            key={j}
                            style={{
                              display: 'block',
                              fontFamily: G, fontSize: '0.75rem',
                              color: '#6B6A64',
                              lineHeight: '1.4',
                            }}
                          >
                            {item.qty > 1 ? `${item.qty}× ` : ''}{item.title}
                          </span>
                        ))}
                      </td>

                      {/* Brutto */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 20 }}>
                        <span style={{ fontFamily: G, color: '#111110', fontWeight: 600 }}>
                          {fmt(o.revenue_gross)}
                        </span>
                      </td>

                      {/* Netto */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 32 }}>
                        <span className="metric" style={{ color: '#6B6A64' }}>
                          {fmt(o.revenue_net)}
                        </span>
                      </td>

                      {/* Produktionskosten */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                          {fmt(o.cost_production)}
                        </span>
                      </td>

                      {/* WeShip variable */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                          {fmt(o.cost_weship)}
                        </span>
                      </td>

                      {/* Shipping */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                          {fmt(o.cost_shipping)}
                        </span>
                      </td>

                      {/* Payment Fee */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 32 }}>
                        <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                          {fmt(o.cost_payment)}
                        </span>
                      </td>

                      {/* Margin */}
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{
                          fontFamily: G, fontSize: '0.8125rem', fontWeight: 600,
                          color: marginColor(o.margin),
                          backgroundColor: marginBg(o.margin),
                          padding: '3px 8px', borderRadius: 6,
                          display: 'inline-block',
                        }}>
                          {o.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals row */}
              {totals && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E3E2DC' }}>
                    <td colSpan={2} style={{ padding: '10px 0', paddingRight: 24 }}>
                      <span className="label" style={{ color: '#6B6A64', letterSpacing: '0.06em' }}>
                        TOTAL — {orders.length} ORDERS
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 20, padding: '10px 20px 10px 0' }}>
                      <span style={{ fontFamily: G, color: '#111110', fontWeight: 700 }}>{fmt(totals.gross)}</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 32, padding: '10px 32px 10px 0' }}>
                      <span style={{ fontFamily: G, color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.net)}</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 16, padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.prod)}</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 16, padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ws)}</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 16, padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ship)}</span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 32, padding: '10px 32px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.pay)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 0' }}>
                      {totalMargin !== null && (
                        <span style={{
                          fontFamily: G, fontSize: '0.8125rem', fontWeight: 700,
                          color: marginColor(totalMargin),
                          backgroundColor: marginBg(totalMargin),
                          padding: '3px 8px', borderRadius: 6,
                          display: 'inline-block',
                        }}>
                          {totalMargin.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </main>
  )
}
