'use client'

import { useState, useEffect, useRef } from 'react'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { useDateRange } from '@/components/providers/DateRangeProvider'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function formatEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

function TipRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '1px 0' }}>
      <span style={{ fontFamily: G, fontSize: '0.6875rem', color: total ? '#C7C6C0' : '#7A7974', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: G, fontSize: '0.6875rem', color: total ? '#F5F4F0' : '#C7C6C0', fontWeight: total ? 600 : 400, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function TipDivider() {
  return <div style={{ height: 1, backgroundColor: '#2A2A28', margin: '5px 0' }} />
}

function WithTip({ tip, children, align = 'right' }: { tip: React.ReactNode; children: React.ReactNode; align?: 'left' | 'right' }) {
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
    ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    backgroundColor: '#1C1C1A',
    borderRadius: 10,
    padding: '10px 14px',
    zIndex: 9999,
    boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
    minWidth: 220,
  } : {}

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
      onMouseEnter={show} onMouseLeave={scheduleHide}>
      <span style={{ borderBottom: rect ? '1px dashed #9E9D98' : '1px dashed transparent', paddingBottom: 1 }}>
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

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TaxQuarter {
  label: string
  period: string
  year: number
  from: string
  to: string
  due: Date
}

function getUpcomingTaxQuarter(today: Date): TaxQuarter {
  const y = today.getFullYear()
  const quarters: TaxQuarter[] = [
    { label: 'Q1', period: 'Jan – Mar', year: y, from: `${y}-01-01`, to: `${y}-03-31`, due: new Date(y, 3, 30) },
    { label: 'Q2', period: 'Apr – Jun', year: y, from: `${y}-04-01`, to: `${y}-06-30`, due: new Date(y, 6, 31) },
    { label: 'Q3', period: 'Jul – Sep', year: y, from: `${y}-07-01`, to: `${y}-09-30`, due: new Date(y, 9, 31) },
    { label: 'Q4', period: 'Oct – Dec', year: y, from: `${y}-10-01`, to: `${y}-12-31`, due: new Date(y + 1, 0, 31) },
  ]
  return quarters.find(q => q.due > today) ?? { label: 'Q1', period: 'Jan – Mar', year: y + 1, from: `${y + 1}-01-01`, to: `${y + 1}-03-31`, due: new Date(y + 1, 3, 30) }
}

interface BankTx {
  id: string
  date: string
  counterparty: string
  reference: string
  amount_eur: number
}

export default function FinancialsPage() {
  const { range } = useDateRange()

  const [txns, setTxns]             = useState<BankTx[]>([])
  const [txnLoading, setTxnLoading] = useState(true)
  const [txnError, setTxnError]     = useState<string | null>(null)

  const [weshipTotal, setWeshipTotal]       = useState<number | null>(null)
  const [weshipFees, setWeshipFees]         = useState<number | null>(null)
  const [weshipShipping, setWeshipShipping] = useState<number | null>(null)
  const [weshipOrderCount, setWeshipOrderCount] = useState<number | null>(null)
  const [taxTotal, setTaxTotal]             = useState<number | null>(null)
  const [taxOrderCount, setTaxOrderCount]   = useState<number | null>(null)
  const [forecastLoading, setForecastLoading] = useState(true)
  const [taxQuarter, setTaxQuarter]         = useState<TaxQuarter | null>(null)

  const today              = new Date()
  const currentMonth       = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const currentMonthLabel  = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const nextMonthLabel     = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    fetch('/api/bank-transactions')
      .then(r => r.json())
      .then(data => {
        setTxns(data.transactions ?? [])
        setTxnLoading(false)
      })
      .catch((e: Error) => {
        setTxnError(e.message)
        setTxnLoading(false)
      })
  }, [])

  useEffect(() => {
    const quarter = getUpcomingTaxQuarter(today)
    setTaxQuarter(quarter)

    Promise.all([
      fetch(`/api/orders?month=${currentMonth}`).then(r => r.json()),
      fetch(`/api/orders?from=${quarter.from}&to=${quarter.to}`).then(r => r.json()),
    ])
      .then(([monthData, taxData]) => {
        const monthOrders: { cost_weship: number; cost_shipping: number }[] = monthData.orders ?? []
        const taxOrders:   { revenue_tax: number }[] = taxData.orders ?? []
        setWeshipTotal(monthOrders.reduce((s, o) => s + o.cost_weship + o.cost_shipping, 0))
        setWeshipFees(monthOrders.reduce((s, o) => s + o.cost_weship, 0))
        setWeshipShipping(monthOrders.reduce((s, o) => s + o.cost_shipping, 0))
        setWeshipOrderCount(monthOrders.length)
        setTaxTotal(taxOrders.reduce((s, o) => s + o.revenue_tax, 0))
        setTaxOrderCount(taxOrders.length)
        setForecastLoading(false)
      })
      .catch(() => setForecastLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Meta Ads prediction — derived from PayPal Europe bank transactions (last 30 days)
  const thirtyDaysAgoStr = (() => {
    const d = new Date(today); d.setDate(d.getDate() - 30); return toDateStr(d)
  })()
  const metaPayments = txns
    .filter(t =>
      t.amount_eur < 0 &&
      t.date >= thirtyDaysAgoStr &&
      t.counterparty.toLowerCase().includes('paypal europe') &&
      /^\d+\/PAYPAL$/.test(t.reference.trim())
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  let metaNextDate: Date | null = null
  let metaNextAmount: number | null = null
  let metaAvgInterval = 0
  if (metaPayments.length >= 2) {
    let totalInterval = 0
    for (let i = 1; i < metaPayments.length; i++) {
      const d1 = new Date(metaPayments[i - 1].date + 'T00:00:00')
      const d2 = new Date(metaPayments[i].date + 'T00:00:00')
      totalInterval += (d2.getTime() - d1.getTime()) / 86400000
    }
    metaAvgInterval = Math.round(totalInterval / (metaPayments.length - 1))
    const avgAmount  = metaPayments.reduce((s, t) => s + Math.abs(t.amount_eur), 0) / metaPayments.length
    const last       = new Date(metaPayments[metaPayments.length - 1].date + 'T00:00:00')
    metaNextDate   = new Date(last.getTime() + metaAvgInterval * 86400000)
    metaNextAmount = Math.round(avgAmount * 100) / 100
  } else if (metaPayments.length === 1) {
    metaNextAmount = Math.abs(metaPayments[0].amount_eur)
  }

  const balance         = txns.reduce((s, t) => s + t.amount_eur, 0)
  const latestDate      = txns.length > 0 ? txns[0].date : null
  const latestDateLabel = latestDate
    ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const [showAllTxns, setShowAllTxns] = useState(false)

  const fromStr  = toDateStr(range.from)
  const toStr    = toDateStr(range.to)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setShowAllTxns(false) }, [fromStr, toStr])
  const filtered = txns.filter(t => t.date >= fromStr && t.date <= toStr)
  const visible  = showAllTxns ? filtered : filtered.slice(0, 10)

  const amountStyle: React.CSSProperties = {
    fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626',
  }

  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
      {/* Header */}
      <div className="mb-4">
        <h1 style={{ fontFamily: G, fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 600, color: '#111110', margin: 0 }}>
          Financials
        </h1>
      </div>

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Bank Account Balance */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC', borderRadius: 16, padding: '24px' }}>
          <span style={{
            fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
            display: 'block', marginBottom: 16,
          }}>
            Bank Account Balance
          </span>

          {txnLoading ? (
            <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>Loading…</span>
          ) : txnError ? (
            <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#DC2626' }}>{txnError}</span>
          ) : (
            <>
              <div style={{ display: 'block', marginBottom: 8 }}>
                <WithTip align="left" tip={
                  <div>
                    <TipRow label="Source" value="Uploaded bank statements" />
                    <TipRow label="Transactions" value={String(txns.length)} />
                    <TipRow label="Latest entry" value={latestDateLabel} />
                    <TipDivider />
                    <div style={{ fontFamily: G, fontSize: '0.6875rem', marginTop: 2 }}>
                      <a href="/dashboard/settings" style={{ color: '#7A7974', textDecoration: 'none' }}>
                        Upload statements in Settings →
                      </a>
                    </div>
                  </div>
                }>
                  <span style={{
                    fontFamily: G, fontSize: '2rem', fontWeight: 700,
                    color: balance >= 0 ? '#111110' : '#DC2626',
                    lineHeight: 1,
                  }}>
                    {formatEur(balance)}
                  </span>
                </WithTip>
              </div>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                as of {latestDateLabel}
              </span>
            </>
          )}
        </div>

        {/* Upcoming Costs Prediction */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC', borderRadius: 16, padding: '24px' }}>
          <span style={{
            fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
            display: 'block', marginBottom: 16,
          }}>
            Upcoming Costs Prediction
          </span>

          {forecastLoading ? (
            <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>Loading…</span>
          ) : (
            // 3-column grid: name | due date | amount — "Due" always starts at the same column
            <div style={{ display: 'grid', gridTemplateColumns: '1fr max-content max-content', columnGap: 20, alignItems: 'center' }}>

              {/* WeShip */}
              <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110', padding: '10px 0' }}>
                WeShip · {currentMonthLabel}
              </span>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', whiteSpace: 'nowrap' }}>
                Due: First week of {nextMonthLabel}
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <WithTip tip={
                  <div>
                    <TipRow label="Orders this month" value={weshipOrderCount !== null ? String(weshipOrderCount) : '—'} />
                    <TipDivider />
                    <TipRow label="Fulfillment fees" value={weshipFees !== null ? formatEur(weshipFees) : '—'} />
                    <TipRow label="Shipping costs" value={weshipShipping !== null ? formatEur(weshipShipping) : '—'} />
                    <TipDivider />
                    <TipRow label="Total" value={weshipTotal !== null ? formatEur(weshipTotal) : '—'} total />
                  </div>
                }>
                  <span style={amountStyle}>{weshipTotal !== null ? formatEur(weshipTotal) : '—'}</span>
                </WithTip>
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F0EFE9' }} />

              {/* VAT */}
              {taxQuarter && (<>
                <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110', padding: '10px 0' }}>
                  VAT {taxQuarter.label} · {taxQuarter.period} {taxQuarter.year}
                </span>
                <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', whiteSpace: 'nowrap' }}>
                  Due: {taxQuarter.due.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <WithTip tip={
                    <div>
                      <TipRow label="Period" value={`${taxQuarter.period} ${taxQuarter.year}`} />
                      <TipRow label="Orders in period" value={taxOrderCount !== null ? String(taxOrderCount) : '—'} />
                      <TipDivider />
                      <TipRow label="Revenue tax collected" value={taxTotal !== null ? formatEur(taxTotal) : '—'} total />
                    </div>
                  }>
                    <span style={amountStyle}>{taxTotal !== null ? formatEur(taxTotal) : '—'}</span>
                  </WithTip>
                </div>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F0EFE9' }} />
              </>)}

              {/* KÖST · Apr – Jun 2026 */}
              <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110', padding: '10px 0' }}>
                KÖST · Apr – Jun 2026
              </span>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', whiteSpace: 'nowrap' }}>
                Due: 15 May 2026
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <WithTip tip={
                  <div>
                    <TipRow label="Abgabenart" value="K 04-06/2026" />
                    <TipRow label="Betrag" value="EUR 125,00" />
                    <TipDivider />
                    <TipRow label="Kto.-Nr." value="68 895/7588" />
                    <TipRow label="IBAN" value="AT12 0100 0000 0553 4681" />
                    <TipRow label="BIC" value="BUNDATWW" />
                  </div>
                }>
                  <span style={amountStyle}>125,00 €</span>
                </WithTip>
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F0EFE9' }} />

              {/* Meta Ads — predicted from PayPal Europe bank transactions */}
              <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110', padding: '10px 0' }}>
                Meta Ads · Ongoing
              </span>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', whiteSpace: 'nowrap' }}>
                {txnLoading
                  ? '—'
                  : metaPayments.length >= 2
                    ? `Due: ${(metaNextDate! < today ? today : metaNextDate!).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : metaPayments.length === 1
                      ? 'Interval unknown'
                      : 'No payments found'}
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <WithTip tip={
                  <div>
                    <TipRow label="Window" value="Last 30 days" />
                    <TipRow label="Matched payments" value={String(metaPayments.length)} />
                    {metaPayments.length >= 2 && (
                      <>
                        <TipDivider />
                        <TipRow label="Avg interval" value={`${metaAvgInterval} days`} />
                        <TipRow label="Last payment" value={metaPayments[metaPayments.length - 1].date} />
                        <TipRow label="Next predicted" value={metaNextDate ? metaNextDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                        <TipDivider />
                        <TipRow label="Predicted amount" value={metaNextAmount !== null ? formatEur(metaNextAmount) : '—'} total />
                      </>
                    )}
                  </div>
                }>
                  <span style={amountStyle}>
                    {txnLoading ? '—' : metaNextAmount !== null ? formatEur(metaNextAmount) : '—'}
                  </span>
                </WithTip>
              </div>

            </div>
          )}
        </div>
      </div>

      <DateRangeBar />

      {/* Transactions */}
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
        borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{
            fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
          }}>
            Transactions
          </span>
          {!txnLoading && (
            <span style={{
              fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
              letterSpacing: '0.08em', color: '#9E9D98', textTransform: 'uppercase' as const,
            }}>
              {filtered.length} Entries
            </span>
          )}
        </div>

        {txnLoading ? (
          <div style={{ padding: '24px 0', fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px 0', fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            No transactions in selected period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{
                    fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
                    letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
                    textAlign: 'left', paddingTop: 0, paddingBottom: 10, paddingLeft: 0, paddingRight: 20,
                    borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' as const,
                  }}>Date</th>
                  <th style={{
                    fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
                    letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
                    textAlign: 'left', paddingTop: 0, paddingBottom: 10, paddingLeft: 0, paddingRight: 20,
                    borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' as const,
                  }}>Reference</th>
                  <th style={{
                    fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
                    letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
                    textAlign: 'right', paddingTop: 0, paddingBottom: 10, paddingLeft: 0, paddingRight: 0,
                    borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' as const,
                  }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                    <td style={{ padding: '12px 20px 12px 0', fontFamily: G, color: '#6B6A64', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' }}>
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 20px 12px 0', verticalAlign: 'middle', overflow: 'hidden' }}>
                      <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#111110', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.counterparty || '—'}
                      </span>
                      {t.reference && (
                        <span style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.reference}
                        </span>
                      )}
                    </td>
                    <td style={{
                      padding: '12px 0', fontFamily: G, fontSize: '0.8125rem', fontWeight: 600,
                      textAlign: 'right', whiteSpace: 'nowrap' as const, verticalAlign: 'middle',
                      color: t.amount_eur >= 0 ? '#0D8585' : '#DC2626',
                    }}>
                      {t.amount_eur >= 0 ? '+' : ''}{formatEur(t.amount_eur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 10 && (
              <div style={{ paddingTop: 14, borderTop: '1px solid #F0EFE9', textAlign: 'center' }}>
                <button
                  onClick={() => setShowAllTxns(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: G, fontSize: '0.75rem', fontWeight: 500,
                    color: '#6B6A64', letterSpacing: '0.02em',
                  }}
                >
                  {showAllTxns ? 'Show less' : `Show all ${filtered.length} transactions`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
