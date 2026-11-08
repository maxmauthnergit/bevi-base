import type { Rating } from '@/data/website-audit'

// Small presentational helpers shared by the website-audit page. Colours come
// from the design tokens in app/globals.css (@theme).

export const RATING_STYLE: Record<Rating, { fg: string; bg: string; label: string }> = {
  gut:     { fg: 'var(--color-accent-fg)', bg: 'rgba(125,239,239,0.18)', label: 'Gut' },
  mittel:  { fg: 'var(--color-warning)',   bg: 'rgba(234,108,0,0.08)',   label: 'Mittel' },
  schwach: { fg: 'var(--color-danger)',    bg: 'rgba(220,38,38,0.08)',   label: 'Schwach' },
}

export function Pill({ children, fg = 'var(--color-text-2)', bg = 'var(--color-surface-2)' }: {
  children: React.ReactNode; fg?: string; bg?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
        fontSize: '0.6875rem', fontWeight: 500, color: fg, backgroundColor: bg,
      }}
    >
      {children}
    </span>
  )
}

export function RatingPill({ rating }: { rating: Rating }) {
  const s = RATING_STYLE[rating]
  return <Pill fg={s.fg} bg={s.bg}>{s.label}</Pill>
}

/** Lighthouse-style score colouring: ≥90 good, 50–89 needs work, <50 poor. */
export function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--color-muted)' }}>—</span>
  const r: Rating = value >= 90 ? 'gut' : value >= 50 ? 'mittel' : 'schwach'
  const s = RATING_STYLE[r]
  return <span className="metric" style={{ color: s.fg, fontWeight: 600 }}>{value}</span>
}

export function GapBadge({ children = 'Datenlücke' }: { children?: React.ReactNode }) {
  return <Pill fg="var(--color-warning)" bg="rgba(234,108,0,0.08)">{children}</Pill>
}

export function SectionTitle({ id, kicker, title, children }: {
  id: string; kicker: string; title: string; children?: React.ReactNode
}) {
  return (
    <div id={id} className="wa-section-title" style={{ margin: '48px 0 16px', scrollMarginTop: 24 }}>
      <span className="label">{kicker}</span>
      <h2 style={{ margin: '8px 0 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>{title}</h2>
      {children && <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-2)', maxWidth: 760, lineHeight: 1.5 }}>{children}</p>}
    </div>
  )
}

export const th: React.CSSProperties = {
  textAlign: 'left', padding: '0 16px 10px 0', borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap', verticalAlign: 'bottom',
}

export const td: React.CSSProperties = {
  padding: '10px 16px 10px 0', borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top', fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.45,
}

export const muted: React.CSSProperties = { color: 'var(--color-text-2)', fontSize: '0.75rem', lineHeight: 1.45 }
