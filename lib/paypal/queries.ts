import { paypalFetch } from './client'
import type { PayPalBalancesResponse, PayPalTransactionsResponse } from './client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFloat(s: string | undefined) {
  return parseFloat(s ?? '0') || 0
}

function isoDate(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, '+0000')
}

// ─── Current EUR balance ──────────────────────────────────────────────────────

export interface PayPalLiveBalance {
  eur_balance:       number
  eur_withheld:      number
  as_of_time:        string
}

export async function getPayPalBalance(): Promise<PayPalLiveBalance> {
  const data = await paypalFetch<PayPalBalancesResponse>(
    '/v1/reporting/balances',
    { currency_code: 'EUR', as_of_time: new Date().toISOString() },
    { next: { revalidate: 300 } }
  )

  const eur = data.balances.find((b) => b.currency_code === 'EUR' || b.total_balance.currency_code === 'EUR')

  return {
    eur_balance:  toFloat(eur?.available_balance?.value),
    eur_withheld: toFloat(eur?.withheld_balance?.value ?? '0'),
    as_of_time:   data.as_of_time ?? new Date().toISOString(),
  }
}

// ─── Last 30 days of transactions ─────────────────────────────────────────────

export interface PayPalTransaction {
  id:       string
  date:     string
  amount:   number
  fee:      number
  status:   string
  subject:  string
}

export async function getPayPalTransactions(): Promise<PayPalTransaction[]> {
  const now  = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  from.setHours(0, 0, 0, 0)

  const data = await paypalFetch<PayPalTransactionsResponse>(
    '/v1/reporting/transactions',
    {
      start_date: isoDate(from),
      end_date:   isoDate(now),
      fields:     'transaction_info',
      page_size:  '500',
    },
    { next: { revalidate: 300 } }
  )

  return (data.transaction_details ?? []).map((d) => {
    const t = d.transaction_info
    return {
      id:      t.transaction_id,
      date:    t.transaction_initiation_date.slice(0, 10),
      amount:  toFloat(t.transaction_amount?.value),
      fee:     toFloat(t.fee_amount?.value ?? '0'),
      status:  t.transaction_status,
      subject: t.transaction_subject ?? t.transaction_note ?? '',
    }
  })
}
