'use client'

import { useState, useEffect, useRef } from 'react'
import React from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import type { OrderRow } from '@/lib/types'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

function countryFlag(cc: string | null) {
  if (!cc) return null
  return (
    <span style={{
      display: 'inline-flex', overflow: 'hidden', borderRadius: 3,
      flexShrink: 0, lineHeight: 0, width: 20, height: 14,
    }}>
      <img
        src={`https://flagcdn.com/w20/${cc.toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/w40/${cc.toLowerCase()}.png 2x`}
        width={20}
        height={14}
        alt={cc.toUpperCase()}
        style={{ display: 'block', objectFit: 'cover', width: '100%', height: '100%' }}
      />
    </span>
  )
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

function TipSource({ source }: { source: 'actual' | 'estimated' | 'shopify' | 'calculated' }) {
  const cfg = source === 'actual'
    ? { color: '#0D8585', label: 'From WeShip invoice' }
    : source === 'estimated'
    ? { color: '#B45309', label: 'Estimated (COGS config)' }
    : source === 'shopify'
    ? { color: '#0D8585', label: 'From Shopify' }
    : { color: '#555550', label: 'Calculated' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: cfg.color }} />
      <span style={{ fontFamily: G, fontSize: '0.5625rem', letterSpacing: '0.05em', color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  )
}

function WithTip({ tip, children }: { tip: React.ReactNode; children: React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref  = useRef<HTMLDivElement>(null)
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    if (hide.current) { clearTimeout(hide.current); hide.current = null }
    if (ref.current) setRect(ref.current.getBoundingClientRect())
  }
  function scheduleHide() {
    hide.current = setTimeout(() => setRect(null), 120)
  }

  const above = rect ? rect.top > 260 : true
  const tipStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    ...(above
      ? { bottom: window.innerHeight - rect.top + 8 }
      : { top: rect.bottom + 8 }),
    right: window.innerWidth - rect.right,
    backgroundColor: '#1C1C1A',
    borderRadius: 10,
    padding: '10px 14px',
    zIndex: 9999,
    boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
    minWidth: 180,
  } : {}
  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <span style={{
        borderBottom: rect ? '1px dashed #9E9D98' : '1px dashed transparent',
        paddingBottom: 1,
      }}>
        {children}
      </span>
      {rect && (
        <div style={tipStyle} onMouseEnter={show} onMouseLeave={scheduleHide}>
          {tip}
        </div>
      )}
    </div>
  )
}

function TipConfigFooter() {
  return (
    <div style={{ marginTop: 6 }}>
      <a
        href="/dashboard/settings"
        style={{ fontFamily: G, fontSize: '0.5625rem', letterSpacing: '0.05em', color: '#555550', textDecoration: 'none' }}
      >
        Calculated based on config · Settings →
      </a>
    </div>
  )
}

// ─── KPI tile components ──────────────────────────────────────────────────────

function KpiHero({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: G, fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9E9D98', marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: G, fontSize: '1.875rem', fontWeight: 700, color: color ?? '#111110', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}

function KpiDetail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '2px 0' }}>
      <span style={{ fontFamily: G, fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9E9D98' }}>{label}</span>
      <span style={{ fontFamily: G, fontSize: '0.75rem', fontWeight: 500, color: color ?? '#6B6A64' }}>{value}</span>
    </div>
  )
}

// ─── Table style constants ────────────────────────────────────────────────────

const thBase: React.CSSProperties = {
  fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
  letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase',
  whiteSpace: 'nowrap', paddingTop: 10, paddingBottom: 10,
  borderBottom: '1px solid #E3E2DC', textAlign: 'right',
}
const groupTh: React.CSSProperties = {
  fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
  letterSpacing: '0.12em', color: '#C7C6C0', textTransform: 'uppercase',
  paddingBottom: 8, borderBottom: 'none', textAlign: 'center',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const today = new Date()
  const [year,  setYear]   = useState(today.getFullYear())
  const [month, setMonth]  = useState(today.getMonth() + 1)
  const [orders, setOrders]   = useState<OrderRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [xlsxInfo, setXlsxInfo] = useState<{
    parsed: boolean
    matched: number
    debug: { headers: string[]; rowCount: number; detectedFormat: string; filename?: string; error?: string }
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setXlsxInfo(null)
    const m = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/orders?month=${m}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setOrders(d.orders); setXlsxInfo(d.xlsx ?? null) }
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
    tax:   orders.reduce((s, o) => s + o.revenue_tax,     0),
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

      {/* ── KPI summary ─────────────────────────────────────────────────────── */}
      {totals && (() => {
        const avgMarginPerOrder = orders!.length > 0
          ? orders!.reduce((s, o) => s + o.margin, 0) / orders!.length
          : 0
        const totalCosts = totals.prod + totals.ws + totals.ship + totals.pay

        const tileLabel: React.CSSProperties = {
          fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#9E9D98', display: 'block', marginBottom: 18,
        }
        const divider = <div style={{ height: 1, backgroundColor: '#F0EFE9', margin: '16px 0' }} />

        return (
          <div style={{
            border: '1px solid #E3E2DC',
            borderRadius: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            backgroundColor: '#E3E2DC',
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>

              {/* Tile 1 — Revenue */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px' }}>
                <span style={tileLabel}>Revenue</span>
                <KpiHero label="Net Revenue" value={fmt(totals.net)} />
                {divider}
                <KpiDetail label="Gross" value={fmt(totals.gross)} />
                <KpiDetail label="Taxes" value={fmt(totals.tax)} />
                <KpiDetail label="Orders" value={String(totals.count)} />
              </div>

              {/* Tile 2 — Costs */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px' }}>
                <span style={tileLabel}>Costs</span>
                <KpiHero label="Total Costs" value={fmt(totalCosts)} />
                {divider}
                <KpiDetail label="Production & IB Shipping" value={fmt(totals.prod)} />
                <KpiDetail label="WeShip" value={fmt(totals.ws)} />
                <KpiDetail label="OB Shipping" value={fmt(totals.ship)} />
                <KpiDetail label="Payment & Shopify" value={fmt(totals.pay)} />
              </div>

              {/* Tile 3 — Profit */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '24px 28px' }}>
                <span style={tileLabel}>Profit</span>
                <KpiHero
                  label="Net Profit"
                  value={fmt(totalDb)}
                  color={totalDb >= 0 ? '#0D8585' : '#DC2626'}
                />
                {divider}
                {totalMargin !== null && (
                  <KpiDetail
                    label="Net Margin"
                    value={`${totalMargin.toFixed(1)}%`}
                    color={marginColor(totalMargin)}
                  />
                )}
                <KpiDetail
                  label="Avg Net Margin / Order"
                  value={`${avgMarginPerOrder.toFixed(1)}%`}
                  color={marginColor(avgMarginPerOrder)}
                />
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Order table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          label="Order List"
          action={
            !loading && xlsxInfo ? (() => {
              const ok    = xlsxInfo.parsed && xlsxInfo.matched > 0
              const color = ok ? '#0D8585' : '#DC2626'
              const text  = xlsxInfo.parsed
                ? `${xlsxInfo.matched} / ${orders?.length ?? 0} from WeShip invoice`
                : xlsxInfo.debug.error ? 'WeShip invoice error' : 'No WeShip invoice'
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: color }} />
                  <span className="label" style={{ color }}>{text}</span>
                </span>
              )
            })() : undefined
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
                <col style={{ width: 28 }} />{/* gap: revenue / costs */}
                <col /><col /><col /><col />
                <col style={{ width: 28 }} />{/* gap: costs / profit */}
                <col />
              </colgroup>

              <thead>
                {/* Group labels */}
                <tr>
                  <th colSpan={2} style={{ ...groupTh, textAlign: 'left' }} />
                  <th colSpan={2} style={{ ...groupTh, borderBottom: '1px solid #E3E2DC' }}>Revenue</th>
                  <th style={{ borderBottom: 'none', padding: 0 }} />
                  <th colSpan={4} style={{ ...groupTh, borderBottom: '1px solid #E3E2DC' }}>Costs</th>
                  <th style={{ borderBottom: 'none', padding: 0 }} />
                  <th style={{ ...groupTh, borderBottom: '1px solid #E3E2DC' }}>Profit</th>
                </tr>
                {/* Column headers */}
                <tr>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 20, minWidth: 90 }}>Order</th>
                  <th style={{ ...thBase, textAlign: 'left', paddingRight: 20, minWidth: 120 }}>Products</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 80 }}>Gross</th>
                  <th style={{ ...thBase, paddingRight: 0,  minWidth: 80 }}>Net</th>
                  {/* Gap: revenue / costs */}
                  <th style={{ borderBottom: '1px solid #E3E2DC', padding: 0 }} />
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 110 }}>Prod. & IB Ship.</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 74 }}>WeShip</th>
                  <th style={{ ...thBase, paddingRight: 16, minWidth: 80 }}>OB Shipping</th>
                  <th style={{ ...thBase, paddingRight: 24, minWidth: 96 }}>Payment & Shopify</th>
                  {/* Gap: costs / profit */}
                  <th style={{ borderBottom: '1px solid #E3E2DC', padding: 0 }} />
                  <th style={{ ...thBase, minWidth: 100 }}>Margin</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((o, i) => {
                  const date    = new Date(o.created_at)
                  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  const db      = o.revenue_net - o.cost_total
                  const isLast  = i === orders.length - 1
                  const td: React.CSSProperties = {
                    padding: '15px 0', verticalAlign: 'middle',
                    borderBottom: !isLast ? '1px solid #F0EFE9' : 'none',
                  }

                  // Build tooltip content helpers
                  const grossTip = (
                    <>
                      <TipLabel>Order items</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.unit_price * it.qty)}
                        />
                      ))}
                      {o.discount > 0 && <TipRow label="Discount" value={`−${fmt(o.discount)}`} />}
                      <TipDivider />
                      <TipRow label="Total gross" value={fmt(o.revenue_gross)} total />
                      <TipDivider />
                      <TipSource source="shopify" />
                    </>
                  )

                  const netTip = (
                    <>
                      <TipLabel>Revenue breakdown</TipLabel>
                      <TipRow label="Gross" value={fmt(o.revenue_gross)} />
                      <TipRow label="Tax (MwSt.)" value={`−${fmt(o.revenue_tax)}`} />
                      <TipDivider />
                      <TipRow label="Net" value={fmt(o.revenue_net)} total />
                      <TipDivider />
                      <TipSource source="shopify" />
                    </>
                  )

                  const prodTip = (
                    <>
                      <TipLabel>Production &amp; IB Shipping</TipLabel>
                      {o.items.map((it, j) => (
                        <React.Fragment key={j}>
                          <TipRow
                            label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title} — manufacturing`}
                            value={fmt(it.cost_manufacturing * it.qty)}
                          />
                          <TipRow
                            label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title} — IB shipping`}
                            value={fmt(it.cost_ib_shipping * it.qty)}
                          />
                        </React.Fragment>
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_production)} total />
                      <TipConfigFooter />
                    </>
                  )

                  const weshipTip = o.weship_source === 'actual' ? (
                    <>
                      <TipLabel>WeShip fulfillment costs</TipLabel>
                      {o.weship_items?.map((it, j) => (
                        <TipRow key={j} label={it.product} value={fmt(it.amount)} />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_weship)} total />
                      <TipDivider />
                      <TipSource source="actual" />
                    </>
                  ) : (
                    <>
                      <TipLabel>WeShip fulfillment costs</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.cost_weship * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_weship)} total />
                      <TipDivider />
                      <TipSource source="estimated" />
                    </>
                  )

                  const shipTip = o.shipping_source === 'actual' ? (
                    <>
                      <TipLabel>Shipping to customer</TipLabel>
                      {o.shipping_items?.map((it, j) => (
                        <TipRow key={j} label={it.product} value={fmt(it.amount)} />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_shipping)} total />
                      <TipDivider />
                      <TipSource source="actual" />
                    </>
                  ) : (
                    <>
                      <TipLabel>Shipping to customer</TipLabel>
                      {o.items.map((it, j) => (
                        <TipRow key={j}
                          label={`${it.qty > 1 ? `${it.qty}× ` : ''}${it.title}`}
                          value={fmt(it.cost_shipping * it.qty)}
                        />
                      ))}
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_shipping)} total />
                      <TipDivider />
                      <TipSource source="estimated" />
                    </>
                  )

                  const payTip = (
                    <>
                      <TipLabel>Shopify payment processing</TipLabel>
                      <TipRow label={`2.0% × ${fmt(o.revenue_gross)}`} value={fmt(Math.round(0.02 * o.revenue_gross * 100) / 100)} />
                      <TipRow label="Fixed fee per order" value={fmt(0.25)} />
                      <TipDivider />
                      <TipRow label="Total" value={fmt(o.cost_payment)} total />
                      <TipConfigFooter />
                    </>
                  )

                  const marginTip = (
                    <>
                      <TipLabel>Profit breakdown</TipLabel>
                      <TipRow label="Net revenue" value={fmt(o.revenue_net)} />
                      <TipRow label="Total costs"  value={`−${fmt(o.cost_total)}`} />
                      <TipDivider />
                      <TipRow label="Net Profit" value={fmt(db)} total />
                      <TipRow label="Margin"       value={`${o.margin.toFixed(1)}%`} total />
                      <TipDivider />
                      <TipSource source="calculated" />
                    </>
                  )

                  return (
                    <tr key={o.id}>
                      {/* Order + date + country badge + fulfillment */}
                      <td style={{ ...td, paddingRight: 20 }}>
                        <span style={{ fontFamily: G, color: '#111110', display: 'block' }}>
                          {o.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' as const }}>
                          <span className="label" style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>{dateStr}</span>
                          {countryFlag(o.country_code)}
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

                      {/* IB Shipping */}
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

                      {/* Gap: costs / profit */}
                      <td style={{ ...td, padding: 0 }} />

                      {/* Margin */}
                      <td style={{ ...td, textAlign: 'right' }}>
                        <WithTip tip={marginTip}>
                          <span style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1,
                            backgroundColor: marginBg(o.margin),
                            padding: '4px 8px', borderRadius: 6, width: 82,
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
                    <td colSpan={2} style={{ padding: '16px 0', paddingRight: 20 }}>
                      <span className="label" style={{ color: '#6B6A64' }}>
                        TOTAL — {totals.count} ORDERS
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 16px 16px 0' }}>
                      <span style={{ fontFamily: G, color: '#111110', fontWeight: 700 }}>{fmt(totals.gross)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 0' }}>
                      <span style={{ fontFamily: G, color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.net)}</span>
                    </td>
                    <td style={{ padding: 0 }} />
                    <td style={{ textAlign: 'right', padding: '16px 16px 16px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.prod)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 16px 16px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ws)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 16px 16px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.ship)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 24px 16px 0' }}>
                      <span className="metric" style={{ color: '#6B6A64', fontWeight: 600 }}>{fmt(totals.pay)}</span>
                    </td>
                    <td style={{ padding: 0 }} />
                    <td style={{ textAlign: 'right', padding: '16px 0' }}>
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
