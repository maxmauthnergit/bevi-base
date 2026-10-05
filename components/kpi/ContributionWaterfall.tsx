'use client'

import { Fragment } from 'react'
import { Card } from '@/components/ui/Card'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

export interface WaterfallData {
  net_revenue:  number
  cogs:         number
  fulfillment:  number
  returns:      number
  fees:         number
  ad_spend:     number
  contribution: number
  storage:      number
  estimated: { cogs: number; fulfillment: number; fees: number }   // % estimated
}

function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' €'
}

type Key = 'net_revenue' | 'cogs' | 'fulfillment' | 'returns' | 'fees' | 'ad_spend' | 'contribution'

interface Row {
  key:         Key
  label:       string
  description: string
  sign:        '' | '−' | '='
  total?:      boolean
  estKey?:     keyof WaterfallData['estimated']
}

const ROWS: Row[] = [
  { key: 'net_revenue',  sign: '',  label: 'Net Revenue',   description: 'Net sales + shipping, excl. VAT', total: true },
  { key: 'cogs',         sign: '−', label: 'COGS',          description: 'Landed cost per unit from inbounds (FIFO): production + freight', estKey: 'cogs' },
  { key: 'fulfillment',  sign: '−', label: 'Fulfillment',   description: 'WeShip pick & pack, packaging, outbound shipping, storage', estKey: 'fulfillment' },
  { key: 'returns',      sign: '−', label: 'Return Costs',  description: 'WeShip return handling from invoices' },
  { key: 'fees',         sign: '−', label: 'Payment Fees',  description: 'Estimated at 2 % + 0.25 € per order', estKey: 'fees' },
  { key: 'ad_spend',     sign: '−', label: 'Ad Spend',      description: 'Meta Ads' },
  { key: 'contribution', sign: '=', label: 'Contribution',  description: 'Net revenue − cost of delivery − ad spend', total: true },
]

export function ContributionWaterfall({ data, loading, error }: {
  data:    WaterfallData | null
  loading: boolean
  error:   boolean
}) {
  return (
    <Card>
      <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {ROWS.map((row, i) => {
          const value = data?.[row.key]
          const shown = row.sign === '−' && value ? -value : value
          const est   = row.estKey && data ? data.estimated[row.estKey] : 0
          const description = row.key === 'fulfillment' && data && data.storage > 0
            ? `${row.description} (storage ${fmtEur(data.storage)})`
            : row.description
          return (
            <Fragment key={row.key}>
              {i > 0 && <div style={{ height: 1, backgroundColor: '#EEEDE8' }} />}
              <div
                className="flex items-start justify-between gap-4"
                style={{ padding: row.total ? '16px 0' : '12px 0' }}
              >
                <div className="flex gap-3 min-w-0">
                  <span style={{
                    width: 12, flexShrink: 0, textAlign: 'center',
                    fontFamily: G, fontSize: row.total ? '1rem' : '0.875rem',
                    color: '#9E9D98', lineHeight: 1.4,
                  }}>
                    {row.sign}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2" style={{
                      fontFamily: G,
                      fontSize:   row.total ? '1rem' : '0.875rem',
                      fontWeight: row.total ? 700 : 400,
                      color:      row.total ? '#111110' : '#3A3A38',
                      lineHeight: 1.4,
                    }}>
                      {row.label}
                      {est > 0.5 && (
                        <span style={{
                          fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.04em',
                          color: '#8A6D1F', backgroundColor: 'rgba(234,179,8,0.14)',
                          borderRadius: 100, padding: '1px 7px', whiteSpace: 'nowrap',
                        }}>
                          Est. {est.toFixed(0)} %
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', marginTop: 2 }}>
                      {description}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontFamily: G,
                  fontSize:   row.total ? '1.125rem' : '0.875rem',
                  fontWeight: row.total ? 700 : 400,
                  color:      row.total ? '#111110' : '#3A3A38',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}>
                  {shown !== undefined ? fmtEur(shown) : error ? '—' : (
                    <span style={{
                      display: 'inline-block', width: 80, height: 16,
                      borderRadius: 4, backgroundColor: '#F0EFE9', verticalAlign: 'middle',
                    }} />
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>
    </Card>
  )
}
