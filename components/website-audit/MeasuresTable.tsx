'use client'

import { useMemo, useState } from 'react'
import { Select } from '@/components/ui/Select'
import {
  IMPLEMENTATIONS, TIMEFRAMES, iceScore,
  type Implementation, type Measure, type Timeframe,
} from '@/data/website-audit'
import { Pill, muted, td, th } from './primitives'

type SortKey = 'ice' | 'impact' | 'confidence' | 'ease' | 'effortDays' | 'id'

const SORT_LABEL: Record<SortKey, string> = {
  ice: 'ICE', impact: 'I', confidence: 'C', ease: 'E', effortDays: 'Tage', id: '#',
}

const TF_STYLE: Record<Timeframe, { fg: string; bg: string }> = {
  'Quick Win':        { fg: 'var(--color-accent-fg)', bg: 'rgba(125,239,239,0.18)' },
  'Nächste 4 Wochen': { fg: 'var(--color-text-2)',    bg: 'var(--color-surface-2)' },
  'Bis DHDL':         { fg: 'var(--color-warning)',   bg: 'rgba(234,108,0,0.08)' },
}

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function value(m: Measure, k: SortKey): number | string {
  return k === 'ice' ? iceScore(m) : m[k]
}

type SortState = { key: SortKey; desc: boolean }

function SortTh({ k, right, sort, onSort }: {
  k: SortKey; right?: boolean; sort: SortState; onSort: (k: SortKey) => void
}) {
  const active = sort.key === k
  return (
    <th className="label" style={{ ...th, textAlign: right ? 'right' : 'left' }}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        data-static
        onClick={() => onSort(k)}
        style={{
          all: 'unset', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', color: active ? 'var(--color-text)' : 'inherit',
        }}
      >
        {SORT_LABEL[k]}{active ? (sort.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )
}

export function MeasuresTable({ measures }: { measures: Measure[] }) {
  const [tf,   setTf]   = useState<'alle' | Timeframe>('alle')
  const [impl, setImpl] = useState<'alle' | Implementation>('alle')
  const [sort, setSort] = useState<SortState>({ key: 'ice', desc: true })
  const [open, setOpen] = useState<string | null>(null)

  const rows = useMemo(() => {
    const filtered = measures.filter(m =>
      (tf === 'alle' || m.timeframe === tf) && (impl === 'alle' || m.implementation === impl))
    return [...filtered].sort((a, b) => {
      const va = value(a, sort.key), vb = value(b, sort.key)
      const c  = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort.desc ? -c : c
    })
  }, [measures, tf, impl, sort])

  const totalDays = rows.reduce((s, m) => s + m.effortDays, 0)
  const onSort = (k: SortKey) =>
    setSort(s => ({ key: k, desc: s.key === k ? !s.desc : k !== 'id' && k !== 'effortDays' }))
  const sp = { sort, onSort }

  return (
    <div>
      <div className="wa-no-print flex flex-wrap items-end gap-3" style={{ marginBottom: 20 }}>
        <label style={{ display: 'grid', gap: 6, minWidth: 180 }}>
          <span className="label">Zeitraum</span>
          <Select value={tf} onChange={v => setTf(v as typeof tf)}>
            <option value="alle">Alle Zeiträume</option>
            {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </label>
        <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
          <span className="label">Umsetzungsart</span>
          <Select value={impl} onChange={v => setImpl(v as typeof impl)}>
            <option value="alle">Alle Umsetzungsarten</option>
            {IMPLEMENTATIONS.map(i => <option key={i} value={i}>{i}</option>)}
          </Select>
        </label>
        <span style={{ ...muted, paddingBottom: 8 }}>
          {rows.length} Maßnahmen · ca. {nf.format(totalDays)} Tage Aufwand
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <SortTh k="id" {...sp} />
              <th className="label" style={th}>Maßnahme</th>
              <SortTh k="ice" right {...sp} />
              <SortTh k="impact" right {...sp} />
              <SortTh k="confidence" right {...sp} />
              <SortTh k="ease" right {...sp} />
              <th className="label" style={th}>Umsetzung</th>
              <SortTh k="effortDays" right {...sp} />
              <th className="label" style={th}>Zeitraum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => {
              const expanded = open === m.id
              return (
                <tr key={m.id} className="wa-avoid-break">
                  <td style={{ ...td, ...muted }} className="metric">{m.id}</td>
                  <td style={{ ...td, minWidth: 280 }}>
                    <button
                      type="button"
                      data-static
                      onClick={() => setOpen(expanded ? null : m.id)}
                      aria-expanded={expanded}
                      className="wa-no-print"
                      style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {m.title} <span style={{ color: 'var(--color-muted)' }}>{expanded ? '–' : '+'}</span>
                    </button>
                    <span className="wa-print-only" style={{ fontWeight: 600 }}>{m.title}</span>
                    <div className={expanded ? undefined : 'wa-print-only'}>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      <p style={{ ...muted, margin: 0 }}><b>Problem:</b> {m.problem}</p>
                      <p style={{ ...muted, margin: 0 }}><b>Maßnahme:</b> {m.action}</p>
                      <p style={{ ...muted, margin: 0 }}><b>Erwarteter Effekt:</b> {m.effect}</p>
                      {m.note && <p style={{ ...muted, margin: 0, color: 'var(--color-warning)' }}><b>Hinweis:</b> {m.note}</p>}
                    </div>
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }} className="metric">{nf.format(iceScore(m))}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{m.impact}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{m.confidence}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{m.ease}</td>
                  <td style={td}><Pill>{m.implementation}</Pill></td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{nf.format(m.effortDays)}</td>
                  <td style={td}><Pill {...TF_STYLE[m.timeframe]}>{m.timeframe}</Pill></td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, ...muted }}>Keine Maßnahme passt zu den Filtern.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, marginTop: 12 }}>
        ICE = Mittelwert aus Impact, Confidence und Ease (je 1–10). Zeile anklicken für Problem, Maßnahme und Effekt.
      </p>
    </div>
  )
}
