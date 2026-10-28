'use client'

import { useCallback, useState } from 'react'
import { fmtDate } from '@/lib/inbound-calc'

/**
 * ECB rate lookup for a form that books amounts in USD.
 *
 * A page can hold several rates at once — the inbound editor has one for
 * production and one per shipment — so busy and note are keyed. The key is the
 * caller's own string ('production', `ship-${i}`, …); nothing here interprets it.
 *
 * `fetchRate` never writes the rate itself: it hands the value to `apply`, so
 * the rate lands wherever that page keeps it.
 */
export function useFxRate() {
  const [fxBusy, setFxBusy] = useState<string | null>(null)
  const [fxNote, setFxNote] = useState<Record<string, string>>({})

  const fetchRate = useCallback(async (
    key:   string,
    date:  string,
    apply: (rate: string) => void,
  ) => {
    if (!date) {
      setFxNote(n => ({ ...n, [key]: 'Pick a date first' }))
      return
    }
    setFxBusy(key)
    setFxNote(n => ({ ...n, [key]: '' }))
    try {
      const res  = await fetch(`/api/fx?date=${date}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Rate lookup failed')
      apply(String(json.rate))
      // The ECB only publishes on business days, so a weekend resolves back to
      // the previous one. Say so rather than booking a rate from an unseen day.
      setFxNote(n => ({
        ...n,
        [key]: json.date !== date ? `ECB rate of ${fmtDate(json.date)}` : '',
      }))
    } catch (e) {
      // The form stays usable: the message says so, and the field is typeable.
      setFxNote(n => ({
        ...n,
        [key]: `${e instanceof Error ? e.message : 'Lookup failed'} — enter it manually`,
      }))
    } finally {
      setFxBusy(null)
    }
  }, [])

  return { fxBusy, fxNote, fetchRate }
}
