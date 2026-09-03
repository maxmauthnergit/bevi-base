// Shared form styling. These used to live inline in the settings page; the
// inbounds and calculator pages need the same look, so they moved here.

export const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/**
 * One height for every control that sits on a form row. Left to the browser,
 * an input, a select and a button come out 27, 29 and 24 px tall, so a button
 * next to a field never lines up. Pinning all three removes that.
 */
export const FIELD_H = 30

export const inp: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.8125rem',
  color: '#111110',
  border: '1px solid #E3E2DC',
  borderRadius: 8,
  padding: '5px 10px',
  height: FIELD_H,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: '#FFFFFF',
}

/**
 * Same footprint as `inp`, for a value that is shown rather than entered — a
 * computed total, a stock figure. (A read-only *date* uses DateReadout instead,
 * which matches the date trigger rather than a text field.)
 */
export const readout: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.8125rem',
  color: '#6B6A64',
  border: '1px solid #E3E2DC',
  borderRadius: 8,
  padding: '5px 10px',
  height: FIELD_H,
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#FAFAF7',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// ─── Buttons ─────────────────────────────────────────────────────────────────
// Four kinds, told apart by colour alone — every other property is shared:
//
//   black  btnLarge   the page's main call to action ("Save changes", "New inbound")
//   blue   btnAccent  the action of a section ("+ Add product", "+ Upload invoice")
//   grey   btn        a sub-action inside a section ("Fetch rate", "Edit", "Open")
//   red    btnDanger  removal
//
// The black one is deliberately bigger and heavier. The other three are all
// FIELD_H tall with the same weight, so a row of them reads as one family and
// none of them is mistaken for a text field — which is why the grey one has a
// tinted ground rather than the white-with-border look of an input.

const btnBase: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.75rem',
  fontWeight: 500,
  letterSpacing: '0.03em',
  lineHeight: 1,
  cursor: 'pointer',
  height: FIELD_H,
  padding: '0 14px',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,               // between an icon and its label
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

/** Grey: a sub-action inside a section. */
export const btn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: '#EBEAE5',
  borderColor: '#DCDBD4',
  color: '#3A3A38',
}

/** Blue: the action of a section. */
export const btnAccent: React.CSSProperties = {
  ...btnBase,
  backgroundColor: 'rgba(125,239,239,0.25)',
  borderColor: '#7DEFEF',
  color: '#0D8585',
}

/** Red: removal. */
export const btnDanger: React.CSSProperties = {
  ...btnBase,
  backgroundColor: 'rgba(220,38,38,0.06)',
  borderColor: 'rgba(220,38,38,0.2)',
  color: '#DC2626',
}

/** Square btnDanger holding only an icon — the row-removal button. */
export const iconBtnDanger: React.CSSProperties = {
  ...btnDanger,
  width: FIELD_H,
  padding: 0,
}

/**
 * Height of the black main call to action. Taller than FIELD_H on purpose: it
 * is the one button on a page that should outweigh the rest. Cancel beside it
 * shares the height so the pair lines up.
 */
export const BTN_LG_H = 36

/** Black: the page's main call to action, e.g. "New inbound", "Save changes". */
export const btnLarge: React.CSSProperties = {
  ...btnBase,
  fontSize: '0.8125rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  padding: '0 20px',
  height: BTN_LG_H,
  backgroundColor: '#111110',
  borderColor: '#111110',
  color: '#FFFFFF',
}

/** The quieter half of a primary pair, e.g. Cancel beside Save changes. */
export const btnLargeSecondary: React.CSSProperties = {
  ...btnLarge,
  fontWeight: 500,
  backgroundColor: '#EBEAE5',
  borderColor: '#DCDBD4',
  color: '#3A3A38',
}

/** Bare icon button, e.g. the chevron that opens a settings section. */
export const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
}

/**
 * Column widths shared by the production table and the per-shipment allocation,
 * so the two read as one grid. Both tables pin them with a <colgroup>.
 */
/** Vertical rhythm around a section heading — matches CardHeader's old mb-8. */
export const SECTION_GAP = 32

/**
 * Fixed height of a heading row. Every heading reserves it whether or not it
 * carries an action button, so the label always sits at the same height and the
 * gap to the content below is the same everywhere.
 */
export const HEADING_ROW_H = BTN_LG_H

export const COL_PRODUCT = 220
export const COL_CHARGE  = 150
export const COL_QTY     = 110

export function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

/**
 * Whole units. `maximumFractionDigits: 0` is not cosmetic: de-DE defaults to 3,
 * and the stock projection subtracts a fractional sales rate every day, so a
 * projected figure printed "428,867" — 428.867 bags, which do not exist.
 */
export function fmtInt(v: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)
}

/** File size for the invoice table. Null when the size was never recorded. */
export function fmtBytes(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v < 0) return '—'
  if (v < 1024) return `${v} B`
  const kb = v / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
