// Shared form styling. These used to live inline in the settings page; the
// inbounds and calculator pages need the same look, so they moved here.

export const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

export const inp: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.8125rem',
  color: '#111110',
  border: '1px solid #E3E2DC',
  borderRadius: 8,
  padding: '5px 10px',
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

export const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
}

export function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

export function fmtInt(v: number) {
  return new Intl.NumberFormat('de-DE').format(v)
}
