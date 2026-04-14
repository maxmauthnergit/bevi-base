'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import type { OrderRow } from '@/lib/types'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

function flag(cc: string | null): string {
  if (!cc || cc.length !== 2) return ''
  return [...cc.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

function marginColor(m: number) {
  return m >= 50 ? '#0D8585' : m >= 25 ? '#B45309' : '#DC2626'
}
function marginBg(m: number) {
  return m >= 50 ? 'rgba(13,133,133,0.07)' : m >= 25 ? 'rgba(180,83,9,0.07)' : 'rgba(220,38,38,0.07)'
}

function fulfillmentBadge(status: string | null) {
  const s = status === 'fulfilled'
    ? { label: 'Fulfilled',       color: '#0D8585', bg: 'rgba(13,133,133,0.08)' }
    : status === 'partial'
    ? { label: 'Part. fulfilled', color: '#B45309', bg: 'rgba(180,83,9,0.08)'   }
    : status === 'restocked'
    ? { label: 'Restocked',       color: '#6B6A64', bg: 'rgba(107,106,100,0.08)'}
    : { label: 'Unfulfilled',     color: '#9E9D98', bg: '#F0EFE9'               }
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function TipRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 20, padding: '1px 0',
    }}>
      <span style={{ fontFamily: G, fontSize: '0.6875rem', color: total ? '#C7C6C0' : '#7A7974', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontFamily: G, fontSize: '0.6875rem', color: total ? '#F5F4F0' : '#C7C6C0', fontWeight: total ? 600 : 400, whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function TipDivider() {
  return <div style={{ height: 1, backgroundColor: '#2A2A28', margin: '5px 0' }} />
}

function TipLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: G, fontSize: '0.5625rem', letterSpacing: '0.08em', color: '#555550', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function WithTip({ tip, children }: { tip: React.ReactNode; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div
      style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        borderBottom: show ? '1px dashed #9E9D98' : '1px dashed transparent',
        paddingBottom: 1,
      }}>
        {children}
      </span>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          right: 0,
          backgroundColor: '#1C1C1A',
          borderRadius: 10,
          padding: '10px 14px',
          zIndex: 200,
          boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          minWidth: 180,
        }}>
          {tip}
        </div>
      )}
    </div>
  )
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      border: '1px solid #E3E2DC',
      borderRadius: 12,
      padding: '14px 18px',
      flex: '1 1 120px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <span className="label" style={{ display: 'block', color: '#9E9D98', marginBottom: 6, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontFamily: G, fontSize: '1.0625rem', fontWeight: 600, color: color ?? '#111110', display: 'block', lineHeight: 1.2 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', display: 'block', marginTop: 3 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ─── Table style constants ────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // Aggregated totals
  const totals = orders?.length ? {
    count: orders.length,
    gross: orders.reduce((s, o) => s + o.revenue_gross,   0),
    net:   orders.reduce((s, o) => s + o.revenue_net,     0),
    prod:  orders.reduce((s, o) => s + o.cost_production, 0),
    ws:    orders.reduce((s, o) => s + o.cost_weship,     0),
    ship:  orders.reduce((s, o) => s + o.cost_shipping,   0),
    pay:   orders.reduce((s, o) => s + o.cost_payment,    0),
    total: orders.reduce((s, o) => s + o.cost_total,      0),
  } : null

  const totalDb     = totals ? totals.net - totals.total : 0
  const totalMargin = totals && totals.net > 0 ? (totalDb / totals.net) * 100 : null

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

      {/* ── KPI summary tiles ───────────────────────────────────────────────── */}
      {totals && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <KpiTile label="Orders"    value={String(totals.count)} />
          <KpiTile label="Gross"     value={fmt(totals.gross)} />
          <KpiTile label="Net"       value={fmt(totals.net)} />
          <KpiTile label="Prod/Ship" value={fmt(totals.prod)} />
          <KpiTile label="WeShip"    value={fmt(totals.ws)} />
          <KpiTile label="Shipping"  value={fmt(totals.ship)} />
          <KpiTile label="Payment"   value={fmt(totals.pay)} />
          <KpiTile
            label="Profit"
            value={fmt(totalDb)}
            color={totalDb >= 0 ? '#0D8585' : '#DC2626'}
          />
          {totalMargin !== null && (
            <KpiTile
              label="Avg Margin"
              value={`${totalMargin.toFixed(1)}%`}
              sub={`on ${totals.count} order${totals.count !== 1 ? 's' : ''}`}
              color={marginColor(totalMargin)}
            />
          )}
        </div>
      )}

      {/* ── Order table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          label="Order List"
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
              <colgroup>
                <col /><col />
                <col /><col />
                {/* gap */}
                <col style={{ width: 28 }} />
                <col /><col /><col /><col />
                <col />
              </colgroup>

              <thead>
                {/* Group labels */}
                <tr>
                  <th colSpan={2} style={{ ...groupTh, textAlign: 'left', paddingBottom: 2 }} />
                  <th colSpan={2} style={{ ...groupTh, borderBottom: '1px solid #E8E7E1', paddingBottom: 4 }}>Revenue</th>
                  <th style={{ borderBottom: 'none', padding: 0 }} />
                  <th colSpan={4} style={{ ...groupTh, borderBottom: '1px solid #E8E7E1', paddingBottom: 4 }}>Costs</th>
                  <th style={{ ...groupTh, paddingBottom: 2 }} />
                </tr>
                {/* Column headers */}
                <tr>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 20, minWidth: 90 }}>Order</th>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 20, minWidth: 160 }}>Products</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 80 }}>Gross</th>
                  <th style={{ ...thBase, paddingRight: 0,  minWidth: 80 }}>Net</th>
                  {/* Gap */}
                  <th style={{ borderBottom: '1px solid #E3E2DC', padding: 0 }} />
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 88 }}>Prod/Ship</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 74 }}>WeShip</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 74 }}>Shipping</th>
                  <th style={{ ...thBase, paddingRight: 24, minWidth: 88 }}>Payment Fee</th>
                  <th style={{ ...thBase, minWidth: 100 }}>Margin</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((o, i) => {
                  const date    = new Date(o.created_at)
                  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  const db      = o.revenue_net - o.cost_total
                  const isLast  = i === orders.length - 1
                  const f       = flag(o.country_code)
                  const td: React.CSSProperties = {
                    padding: '11px 0', verticalAlign: 'middle',
                    borderBottom: !isLast ? '1px solid #F0EFE9' : 'none',
                  }

                  // Build tooltip content helpers
                  const grossTip = (
                    <>
                      <TipLabel>Line items</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.unit_price * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total gross" value={fmt(o.revenue_gross)} total />
                    </>
                  )

                  const netTip = (
                    <>
                      <TipLabel>Revenue breakdown</TipLabel>
                      <TipRow label="Gross" value={fmt(o.revenue_gross)} />
                      <TipRow label="Tax (MwSt.)" value={`−${fmt(o.revenue_tax)}`} />
                      <TipDivider />
                      <TipRow label="Net" value={fmt(o.revenue_net)} total />
                    </>
                  )

                  const prodTip = (
                    <>
                      <TipLabel>Material + Shipping ins Lager</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.cost_production * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_production)} total />
                    </>
                  )

                  const weshipTip = (
                    <>
                      <TipLabel>Auftragsabw. · Komm. · Verpackung · Lager</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.cost_weship * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_weship)} total />
                    </>
                  )

                  const shipTip = (
                    <>
                      <TipLabel>Post / DHL to end customer</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.cost_shipping * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_shipping)} total />
                    </>
                  )

                  const payTip = (
                    <>
                      <TipLabel>Shopify payment processing</TipLabel>
                      <TipRow label={`2.0% × ${fmt(o.revenue_gross)}`} value={fmt(Math.round(0.02 * o.revenue_gross * 100) / 100)} />
                      <TipRow label="Fixed fee per order" value={fmt(0.25)} />
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_payment)} total />
                    </>
                  )

                  const marginTip = (
                    <>
                      <TipLabel>Profit breakdown</TipLabel>
                      <TipRow label="Net revenue" value={fmt(o.revenue_net)} />
                      <TipRow label="Total costs"  value={`−${fmt(o.cost_total)}`} />
                      <TipDivider />
                      <TipRow label="Profit (DB)" value={fmt(db)} total />
                      <TipRow label="Margin"       value={`${o.margin.toFixed(1)}%`} total />
                    </>
                  )

                  return (
                    <tr key={o.id}>
                      {/* Order + date + country + fulfillment */}
                      <td style={{ ...td, paddingRight: 20 }}>
                        <span style={{ fontFamily: G, color: '#111110', display: 'block' }}>
                          {f && <span style={{ marginRight: 5, fontSize: '0.875rem' }}>{f}</span>}
                          {o.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span className="label" style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>{dateStr}</span>
                          {fulfillmentBadge(o.fulfillment_status)}
                        </span>
                      </td>

                      {/* Products */}
                      <td style={{ ...td, paddingRight: 20 }}>
                        {o.items.map((item, j) => (
                          <span key={j} style={{ display: 'block', fontFamily: G, fontSize: '0.75rem', color: '#6B6A64', lineHeight: '1.4' }}>
                            {item.qty > 1 ? `${item.qty}× ` : ''}{item.title}
                          </span>
                        ))}
                      </td>

                      {/* Gross */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <WithTip tip={grossTip}>
                          <span style={{ fontFamily: G, color: '#111110', fontWeight: 600 }}>
                            {fmt(o.revenue_gross)}
                          </span>
                        </WithTip>
                      </td>

                      {/* Net */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 0 }}>
                        <WithTip tip={netTip}>
                          <span className="metric" style={{ color: '#6B6A64' }}>
                            {fmt(o.revenue_net)}
                          </span>
                        </WithTip>
                      </td>

                      {/* Gap */}
                      <td style={{ ...td, padding: 0 }} />

                      {/* Prod/Ship */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <WithTip tip={prodTip}>
                          <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                            {fmt(o.cost_production)}
                          </span>
                        </WithTip>
                      </td>

                      {/* WeShip */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <WithTip tip={weshipTip}>
                          <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                            {fmt(o.cost_weship)}
                          </span>
                        </WithTip>
                      </td>

                      {/* Shipping */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 16 }}>
                        <WithTip tip={shipTip}>
                          <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                            {fmt(o.cost_shipping)}
                          </span>
                        </WithTip>
                      </td>

                      {/* Payment Fee */}
                      <td style={{ ...td, textAlign: 'right', paddingRight: 24 }}>
                        <WithTip tip={payTip}>
                          <span className="metric" style={{ color: '#6B6A64', fontSize: '0.75rem' }}>
                            {fmt(o.cost_payment)}
                          </span>
                        </WithTip>
                      </td>

                      {/* Margin */}
                      <td style={{ ...td, textAlign: 'right' }}>
                        <WithTip tip={marginTip}>
                          <span style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1,
                            backgroundColor: marginBg(o.margin),
                            padding: '4px 8px', borderRadius: 6,
                          }}>
                            <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: marginColor(o.margin), lineHeight: 1.2 }}>
                              {o.margin.toFixed(1)}%
                            </span>
                            <span style={{ fontFamily: G, fontSize: '0.625rem', color: marginColor(o.margin), opacity: 0.75, lineHeight: 1.2 }}>
                              {fmt(db)}
                            </span>
                          </span>
                        </WithTip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals row */}
              {totals && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E3E2DC' }}>
                    <td colSpan={2} style={{ padding: '10px 0', paddingRight: 20 }}>
                      <span className="label" style={{ color: '#6B6A64', letterSpacing: '0.06em' }}>
                        TOTAL — {totals.count} ORDERS
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px 10px 0' }}>
                      <span style={{ fontFamily: G, color: '#111110', fontWeight: 700 }}>{fmt(totals.gross)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 0' }}>
                      <span style={{ fontFamily: G, color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.net)}</span>
                    </td>
                    <td style={{ padding: 0 }} />
                    <td style={{ textAlign: 'right', padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.prod)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ws)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ship)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 24px 10px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.pay)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 0' }}>
                      {totalMargin !== null && (
                        <span style={{
                          display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1,
                          backgroundColor: marginBg(totalMargin),
                          padding: '4px 8px', borderRadius: 6,
                        }}>
                          <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 700, color: marginColor(totalMargin), lineHeight: 1.2 }}>
                            {totalMargin.toFixed(1)}%
                          </span>
                          <span style={{ fontFamily: G, fontSize: '0.625rem', color: marginColor(totalMargin), opacity: 0.75, lineHeight: 1.2 }}>
                            {fmt(totalDb)}
                          </span>
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
