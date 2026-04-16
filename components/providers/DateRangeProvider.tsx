'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { defaultDateRange } from '@/lib/date-range'
import type { DateRange } from '@/lib/date-range'

const STORAGE_KEY = 'bevi-date-range'

interface Ctx { range: DateRange; setRange: (r: DateRange) => void }

const DateRangeCtx = createContext<Ctx | null>(null)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(defaultDateRange)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const p = JSON.parse(raw)
      setRangeState({ ...p, from: new Date(p.from), to: new Date(p.to) })
    } catch {}
  }, [])

  const setRange = useCallback((r: DateRange) => {
    setRangeState(r)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) } catch {}
  }, [])

  return <DateRangeCtx.Provider value={{ range, setRange }}>{children}</DateRangeCtx.Provider>
}

export function useDateRange() {
  const ctx = useContext(DateRangeCtx)
  if (!ctx) throw new Error('useDateRange must be used inside DateRangeProvider')
  return ctx
}
