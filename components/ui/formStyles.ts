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

export const btn: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.75rem',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  padding: '4px 12px',
  borderRadius: 8,
  border: '1px solid #E3E2DC',
  backgroundColor: '#FFFFFF',
  color: '#6B6A64',
}

export const btnPrimary: React.CSSProperties = {
  ...btn,
  backgroundColor: '#111110',
  borderColor: '#111110',
  color: '#FFFFFF',
}

export const btnDanger: React.CSSProperties = {
  ...btn,
  color: '#DC2626',
  borderColor: 'rgba(220,38,38,0.2)',
}

/** Sits on a form row: same height as the field beside it, roomier padding. */
export const btnField: React.CSSProperties = {
  ...btn,
  height: FIELD_H,
  padding: '0 16px',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/** "Add …" actions. Coloured, but the dark primary stays the strongest action. */
export const btnAccent: React.CSSProperties = {
  ...btn,
  height: FIELD_H,
  padding: '0 16px',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(125,239,239,0.25)',
  borderColor: '#7DEFEF',
  color: '#0D8585',
  fontWeight: 500,
}

/** Page-level primary, e.g. "New Inbound" — needs to read as the main action. */
export const btnLarge: React.CSSProperties = {
  ...btnPrimary,
  fontSize: '0.8125rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  padding: '8px 18px',
}

export const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
}

/** Row-removal button: field height, faint red ground so it reads as destructive. */
export const iconBtnDanger: React.CSSProperties = {
  height: FIELD_H,
  width: FIELD_H,
  boxSizing: 'border-box',
  border: '1px solid rgba(220,38,38,0.2)',
  backgroundColor: 'rgba(220,38,38,0.06)',
  color: '#DC2626',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
}

/**
 * Column widths shared by the production table and the per-shipment allocation,
 * so the two read as one grid. Both tables pin them with a <colgroup>.
 */
export const COL_PRODUCT = 220
export const COL_QTY     = 110

export function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

export function fmtInt(v: number) {
  return new Intl.NumberFormat('de-DE').format(v)
}
