'use client'

import { useState, useEffect } from 'react'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { useDateRange } from '@/components/providers/DateRangeProvider'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function formatEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
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

  const [txns, setTxns]           = useState<BankTx[]>([])
  const [txnLoading, setTxnLoading] = useState(true)
  const [txnError, setTxnError]   = useState<string | null>(null)

  const [weshipTotal, setWeshipTotal]     = useState<number | null>(null)
  const [taxTotal, setTaxTotal]           = useState<number | null>(null)
  const [metaSpend, setMetaSpend]         = useState<number | null>(null)
  const [forecastLoading, setForecastLoading] = useState(true)
  const [taxQuarter, setTaxQuarter]       = useState<TaxQuarter | null>(null)

  const today         = new Date()
  const currentMonth  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const currentMonthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const nextMonthLabel    = new Date(today.getFullYear(), today.getMonth() + 1, 1)
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
      fetch('/api/meta/spend').then(r => r.json()),
    ])
      .then(([monthData, taxData, metaData]) => {
        const monthOrders: { cost_weship: number; cost_shipping: number }[] = monthData.orders ?? []
        const taxOrders:   { revenue_tax: number }[] = taxData.orders ?? []
        setWeshipTotal(monthOrders.reduce((s, o) => s + o.cost_weship + o.cost_shipping, 0))
        setTaxTotal(taxOrders.reduce((s, o) => s + o.revenue_tax, 0))
        setMetaSpend(metaData.spend_mtd ?? null)
        setForecastLoading(false)
      })
      .catch(() => setForecastLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const balance    = txns.reduce((s, t) => s + t.amount_eur, 0)
  const latestDate = txns.length > 0 ? txns[0].date : null
  const latestDateLabel = latestDate
    ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const fromStr  = toDateStr(range.from)
  const toStr    = toDateStr(range.to)
  const filtered = txns.filter(t => t.date >= fromStr && t.date <= toStr)

  return (
    <main style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div className="mb-4">
        <h1 style={{ fontFamily: G, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: 0 }}>
          Financials
        </h1>
      </div>

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Bank Account Balance */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC', borderRadius: 16, padding: '24px' }}>
          <span style={{
            fontFamily: G, fontSize: '0.625rem', fontWeight: 600,
            letterSpacing: '0.08em', color: '#9E9D98', textTransform: 'uppercase' as const,
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
              <span style={{
                fontFamily: G, fontSize: '2rem', fontWeight: 700,
                color: balance >= 0 ? '#111110' : '#DC2626',
                display: 'block', lineHeight: 1, marginBottom: 8,
              }}>
                {formatEur(balance)}
              </span>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                as of {latestDateLabel}
              </span>
            </>
          )}
        </div>

        {/* Upcoming Costs Prediction */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC', borderRadius: 16, padding: '24px' }}>
          <span style={{
            fontFamily: G, fontSize: '0.625rem', fontWeight: 600,
            letterSpacing: '0.08em', color: '#9E9D98', textTransform: 'uppercase' as const,
            display: 'block', marginBottom: 16,
          }}>
            Upcoming Costs Prediction
          </span>

          {forecastLoading ? (
            <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>Loading…</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* WeShip */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110' }}>
                    WeShip · {currentMonthLabel}
                  </span>
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626' }}>
                    {weshipTotal !== null ? formatEur(weshipTotal) : '—'}
                  </span>
                </div>
                <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                  Due: First week of {nextMonthLabel}
                </span>
              </div>

              <div style={{ borderTop: '1px solid #F0EFE9' }} />

              {/* VAT */}
              {taxQuarter && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110' }}>
                      VAT {taxQuarter.label} · {taxQuarter.period} {taxQuarter.year}
                    </span>
                    <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626' }}>
                      {taxTotal !== null ? formatEur(taxTotal) : '—'}
                    </span>
                  </div>
                  <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                    Due: {taxQuarter.due.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}

              <div style={{ borderTop: '1px solid #F0EFE9' }} />

              {/* Meta Ads */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#111110' }}>
                    Meta Ads · {currentMonthLabel}
                  </span>
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626' }}>
                    {metaSpend !== null ? formatEur(metaSpend) : '—'}
                  </span>
                </div>
                <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                  MTD spend · billed continuously via payment method
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Range Bar */}
      <DateRangeBar />

      {/* Transactions */}
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
        borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        padding: '20px 24px',
      }}>
        {/* Header — TRANSACTIONS label left, entry count right, no dividing line */}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
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
                  }}>Counterparty / Betreff</th>
                  <th style={{
                    fontFamily: G, fontSize: '0.625rem', fontWeight: 500,
                    letterSpacing: '0.12em', color: '#9E9D98', textTransform: 'uppercase' as const,
                    textAlign: 'right', paddingTop: 0, paddingBottom: 10, paddingLeft: 0, paddingRight: 0,
                    borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' as const,
                  }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                    <td style={{ padding: '12px 20px 12px 0', fontFamily: G, color: '#6B6A64', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' }}>
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 20px 12px 0', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#111110', display: 'block' }}>
                        {t.counterparty || '—'}
                      </span>
                      {t.reference && (
                        <span style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98' }}>
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
          </div>
        )}
      </div>
    </main>
  )
}
