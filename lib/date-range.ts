// ─── Shared date range types and utilities ────────────────────────────────────

export interface DateRange {
  from:    Date
  to:      Date
  label:   string
  preset?: PresetId   // set when a named preset is active
  month?:  string     // set when month-navigation mode (YYYY-MM)
}

export const PRESETS = [
  { id: 'today',        label: 'Today'        },
  { id: 'yesterday',    label: 'Yesterday'    },
  { id: 'last-7',       label: 'Last 7 days'  },
  { id: 'last-30',      label: 'Last 30 days' },
  { id: 'last-month',   label: 'Last month'   },
  { id: 'last-quarter', label: 'Last quarter' },
  { id: 'ytd',          label: 'YTD'          },
  { id: 'last-year',    label: 'Last year'    },
  { id: 'all-time',     label: 'All time'     },
] as const satisfies { id: string; label: string }[]

export type PresetId = typeof PRESETS[number]['id']

const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtDateRange(from: Date, to: Date): string {
  const d   = (n: Date) => String(n.getDate()).padStart(2, '0')
  const mon = (n: Date) => M[n.getMonth()]
  const yr  = (n: Date) => n.getFullYear()

  if (yr(from) === yr(to) && from.getMonth() === to.getMonth())
    return `${d(from)} – ${d(to)} ${mon(to)} ${yr(to)}`
  if (yr(from) === yr(to))
    return `${d(from)} ${mon(from)} – ${d(to)} ${mon(to)} ${yr(to)}`
  return `${d(from)} ${mon(from)} ${yr(from)} – ${d(to)} ${mon(to)} ${yr(to)}`
}

export function fmtYM(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  return `${M[mo - 1]} ${y}`
}

export function toYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function offsetYM(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function allMonthsInRange(from: Date, to: Date): string[] {
  const out: string[] = []
  let y = from.getFullYear(), m = from.getMonth()
  const endN = to.getFullYear() * 12 + to.getMonth()
  while (y * 12 + m <= endN) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`)
    if (++m > 11) { m = 0; y++ }
  }
  return out
}

function computePreset(id: PresetId, now: Date = new Date()): { from: Date; to: Date } {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  switch (id) {
    case 'today':
      return { from: new Date(y, m, d), to: new Date(y, m, d, 23, 59, 59, 999) }
    case 'yesterday':
      return { from: new Date(y, m, d - 1), to: new Date(y, m, d - 1, 23, 59, 59, 999) }
    case 'last-7':
      return { from: new Date(y, m, d - 6), to: new Date(y, m, d, 23, 59, 59, 999) }
    case 'last-30':
      return { from: new Date(y, m, d - 29), to: new Date(y, m, d, 23, 59, 59, 999) }
    case 'last-month':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59, 999) }
    case 'last-quarter': {
      const qs = Math.floor(m / 3) * 3 - 3
      if (qs < 0) return { from: new Date(y - 1, 9, 1), to: new Date(y, 0, 0, 23, 59, 59, 999) }
      return { from: new Date(y, qs, 1), to: new Date(y, qs + 3, 0, 23, 59, 59, 999) }
    }
    case 'ytd':
      return { from: new Date(y, 0, 1), to: new Date(y, m, d, 23, 59, 59, 999) }
    case 'last-year':
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59, 999) }
    case 'all-time':
      return { from: new Date(2024, 10, 1), to: new Date(y, m, d, 23, 59, 59, 999) }
  }
}

export function makePresetRange(id: PresetId): DateRange {
  const { from, to } = computePreset(id)
  return { from, to, label: PRESETS.find(p => p.id === id)!.label, preset: id }
}

export function makeMonthRange(ym: string): DateRange {
  const [y, mo] = ym.split('-').map(Number)
  return {
    from:  new Date(y, mo - 1, 1),
    to:    new Date(y, mo, 0, 23, 59, 59, 999),
    label: fmtYM(ym),
    month: ym,
  }
}

export function defaultDateRange(): DateRange {
  return makePresetRange('last-30')
}
