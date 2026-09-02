'use client'

import { Field } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { G, inp, btnField } from '@/components/ui/formStyles'

/**
 * FX date + rate + lookup button. Used by the inbound editor for production and
 * for every shipment, and by the calculator for its single rate.
 *
 * Purely presentational — the lookup itself lives in `useFxRate`, so a page can
 * hold several of these without duplicating that logic.
 */
export function RateRow({
  date, rate, busy, note, onDate, onRate, onFetch,
}: {
  date:    string
  rate:    string
  busy:    boolean
  note?:   string
  onDate:  (v: string) => void
  onRate:  (v: string) => void
  onFetch: () => void
}) {
  return (
    <div>
      <div className="flex gap-3 flex-wrap items-end">
        <div style={{ width: 165 }}>
          <Field label="FX date">
            <DatePicker value={date} onChange={onDate} />
          </Field>
        </div>
        <div style={{ width: 130 }}>
          <Field label="USD → EUR">
            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.0001"
              placeholder="0.0000" value={rate} onChange={e => onRate(e.target.value)} />
          </Field>
        </div>
        <button style={btnField} disabled={busy} onClick={onFetch}>
          {busy ? 'Fetching…' : 'Fetch rate'}
        </button>
      </div>
      {note && (
        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#EA6C00', marginTop: 6 }}>
          {note}
        </p>
      )}
    </div>
  )
}
