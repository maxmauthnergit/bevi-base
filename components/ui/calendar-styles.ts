// ─── Shared calendar styling ─────────────────────────────────────────────────
// Pure constants and helpers lifted out of DateRangeBar so the single-date
// DatePicker looks identical to the range bar. No behaviour lives here.
//
// Grey hierarchy:
//   #111110  selected / active  (dark pill bg, bold month label)
//   #6B6A64  default interactive (all clickable items when not selected)
//   #9E9D98  auxiliary / decorative (chevrons, captions, dividers)

export const G  = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const FS = '0.75rem'

export const NAV_BTN: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '6px 8px', borderRadius: 6, flexShrink: 0,
  color: '#9E9D98', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: G, fontSize: FS, fontWeight: 500, letterSpacing: '0.02em',
    padding: '5px 11px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: active ? '#111110' : 'transparent',
    color:           active ? '#FFFFFF' : '#6B6A64',
    transition: 'background 0.1s, color 0.1s',
  }
}

export const POPOVER: React.CSSProperties = {
  position: 'absolute', zIndex: 200,
  backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
  borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  padding: '20px', width: 296,
  fontFamily: G,
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const DAY_ABBR = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDisplayDate(ds: string): string {
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Day cells for a month grid: leading blanks so the 1st lands on its weekday
// (Monday-first), then the days, then trailing blanks to fill the last row.
export function monthCells(year: number, month: number): (string | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMo = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMo; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function dayCellStyle({
  selected, inRange, isToday,
}: {
  selected: boolean
  inRange:  boolean
  isToday:  boolean
}): React.CSSProperties {
  return {
    border: 'none', cursor: 'pointer',
    borderRadius: 7, padding: '5px 0',
    textAlign: 'center', fontSize: FS,
    fontFamily: G, fontWeight: selected ? 600 : 400,
    backgroundColor: selected ? '#111110' : inRange ? '#F0EFE9' : 'transparent',
    color: selected ? '#FFFFFF' : isToday && !inRange ? '#111110' : '#6B6A64',
    boxShadow: isToday && !selected ? 'inset 0 0 0 1.5px #E3E2DC' : 'none',
  }
}
