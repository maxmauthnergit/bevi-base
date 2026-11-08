// ─── Comparison period for date-range KPIs ───────────────────────────────────
// What a selected range is compared against: the previous calendar unit for
// month / quarter / year presets, the same span of the previous year for YTD,
// otherwise the same duration directly before. All boundaries are wall-clock
// times in the shop timezone.

import { parseInTimezone } from '@/lib/shopify/queries'

export interface PeriodBounds {
  fromDate: Date
  toDate:   Date
}

export interface ComparisonInput {
  from:    string          // YYYY-MM-DD
  to:      string          // YYYY-MM-DD
  preset?: string | null
  month?:  string | null   // YYYY-MM
  tz:      string
}

/** Current bounds plus the comparison period; `prev` is null for all-time. */
export function resolvePeriods({ from, to, preset, month, tz }: ComparisonInput): PeriodBounds & { prev: PeriodBounds | null } {
  const fromDate = parseInTimezone(from, '00:00:00', tz)
  const toDate   = parseInTimezone(to,   '23:59:59', tz)
  if (preset === 'all-time') return { fromDate, toDate, prev: null }

  const durMs = toDate.getTime() - fromDate.getTime()
  const ptz = (dateStr: string, t: '00:00:00' | '23:59:59') => parseInTimezone(dateStr, t, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ds  = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

  // from/to as a wall-clock date in the store timezone (for calendar-aware presets)
  const fromWall = new Date(from + 'T12:00:00Z') // noon UTC ≈ correct calendar date anywhere
  const toWall   = new Date(to   + 'T12:00:00Z')

  let prevFromDate: Date
  let prevToDate: Date

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const prevM   = m === 1 ? 12 : m - 1
    const prevY   = m === 1 ? y - 1 : y
    const lastDay = new Date(prevY, prevM, 0).getDate()
    const toDay   = Math.min(toWall.getUTCDate(), lastDay)
    prevFromDate  = ptz(ds(prevY, prevM, 1),     '00:00:00')
    prevToDate    = ptz(ds(prevY, prevM, toDay), '23:59:59')
  } else if (preset === 'last-month') {
    const prevTo = new Date(Date.UTC(fromWall.getUTCFullYear(), fromWall.getUTCMonth(), 0))
    prevFromDate = ptz(ds(prevTo.getUTCFullYear(), prevTo.getUTCMonth() + 1, 1), '00:00:00')
    prevToDate   = ptz(ds(prevTo.getUTCFullYear(), prevTo.getUTCMonth() + 1, prevTo.getUTCDate()), '23:59:59')
  } else if (preset === 'last-quarter') {
    const prevTo   = new Date(fromDate.getTime() - 86_400_000)
    const qStart   = Math.floor(prevTo.getUTCMonth() / 3) * 3
    prevFromDate   = ptz(ds(prevTo.getUTCFullYear(), qStart + 1, 1), '00:00:00')
    prevToDate     = ptz(ds(prevTo.getUTCFullYear(), qStart + 3, new Date(prevTo.getUTCFullYear(), qStart + 3, 0).getDate()), '23:59:59')
  } else if (preset === 'ytd') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1), '00:00:00')
    prevToDate   = ptz(ds(prevY, toWall.getUTCMonth() + 1, toWall.getUTCDate()), '23:59:59')
  } else if (preset === 'last-year') {
    const prevY  = fromWall.getUTCFullYear() - 1
    prevFromDate = ptz(ds(prevY, 1, 1),   '00:00:00')
    prevToDate   = ptz(ds(prevY, 12, 31), '23:59:59')
  } else {
    // today, yesterday, last-7, last-30, custom: same duration shifted back
    prevToDate   = new Date(fromDate.getTime() - 1)
    prevFromDate = new Date(prevToDate.getTime() - durMs)
  }

  return { fromDate, toDate, prev: { fromDate: prevFromDate, toDate: prevToDate } }
}

/** A Date as YYYY-MM-DD in the given timezone. */
export function isoInTZ(d: Date, tz: string): string {
  return d.toLocaleDateString('sv', { timeZone: tz })
}
