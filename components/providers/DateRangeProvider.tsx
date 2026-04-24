'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { defaultDateRange } from '@/lib/date-range'
import type { DateRange } from '@/lib/date-range'

interface Ctx { range: DateRange; setRange: (r: DateRange) => void }

const DateRangeCtx = createContext<Ctx | null>(null)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(defaultDateRange)

  const setRange = useCallback((r: DateRange) => {
    setRangeState(r)
  }, [])

  return <DateRangeCtx.Provider value={{ range, setRange }}>{children}</DateRangeCtx.Provider>
}

export function useDateRange() {
  const ctx = useContext(DateRangeCtx)
  if (!ctx) throw new Error('useDateRange must be used inside DateRangeProvider')
  return ctx
}
