'use client'

import { useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  PRESETS, makePresetRange, makeMonthRange,
  fmtDateRange, fmtYM, toYM, offsetYM,
} from '@/lib/date-range'
import type { PresetId } from '@/lib/date-range'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function toInputVal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DateRangeBar() {
  const { range, setRange } = useDateRange()

  const [showCustom,   setShowCustom]   = useState(false)
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')

  const displayYM = range.month ?? toYM(range.from)
  const isCustom  = !range.preset && !range.month

  function selectPreset(id: PresetId) {
    setShowCustom(false)
    setRange(makePresetRange(id))
  }

  function navMonth(delta: number) {
    setShowCustom(false)
    setRange(makeMonthRange(offsetYM(displayYM, delta)))
  }

  function openCustom() {
    setCustomFrom(toInputVal(range.from))
    setCustomTo(toInputVal(range.to))
    setShowCustom(true)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    const from = new Date(customFrom + 'T00:00:00')
    const to   = new Date(customTo   + 'T23:59:59')
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return
    setRange({ from, to, label: fmtDateRange(from, to) })
    setShowCustom(false)
  }

  const arrow: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1,
    padding: '5px 9px', borderRadius: 6, color: '#9E9D98',
    fontFamily: G, fontSize: '1rem', display: 'flex', alignItems: 'center',
  }

  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: G, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.02em',
    padding: '5px 10px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? 'none' : '1px solid transparent',
    backgroundColor: active ? '#111110' : 'transparent',
    color: active ? '#FFFFFF' : '#6B6A64',
    transition: 'all 0.1s',
  })

  const dateInp: React.CSSProperties = {
    fontFamily: G, fontSize: '0.75rem', color: '#111110',
    border: '1px solid #E3E2DC', borderRadius: 8, padding: '4px 8px',
    outline: 'none', backgroundColor: '#FFFFFF',
  }

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
      borderRadius: 16, padding: '8px 16px',
      display: 'flex', alignItems: 'center',
      marginBottom: 24,
    }}>

      {/* Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        paddingRight: 16, marginRight: 16,
        borderRight: '1px solid #F0EFE9', flexShrink: 0,
      }}>
        <button style={arrow} onClick={() => navMonth(-1)}>‹</button>
        <span style={{
          fontFamily: G, fontSize: '0.8125rem', fontWeight: 500, color: '#111110',
          minWidth: 84, textAlign: 'center', padding: '0 2px',
        }}>
          {fmtYM(displayYM)}
        </span>
        <button style={arrow} onClick={() => navMonth(+1)}>›</button>
      </div>

      {/* Preset pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.id} style={pill(range.preset === p.id)} onClick={() => selectPreset(p.id as PresetId)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div style={{
        paddingLeft: 16, marginLeft: 16,
        borderLeft: '1px solid #F0EFE9', flexShrink: 0,
      }}>
        {showCustom ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={dateInp} />
            <span style={{ color: '#9E9D98', fontFamily: G, fontSize: '0.75rem' }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={dateInp} />
            <button style={{ ...pill(true), padding: '5px 14px' }} onClick={applyCustom}>Apply</button>
            <button style={{ ...arrow, color: '#C7C6C0', fontSize: '0.75rem', padding: '5px 6px' }} onClick={() => setShowCustom(false)}>✕</button>
          </div>
        ) : (
          <button
            style={{ ...pill(isCustom), display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}
            onClick={openCustom}
          >
            <span>{fmtDateRange(range.from, range.to)}</span>
            <span style={{ fontSize: '0.5625rem', color: isCustom ? 'rgba(255,255,255,0.6)' : '#C7C6C0' }}>▾</span>
          </button>
        )}
      </div>
    </div>
  )
}
