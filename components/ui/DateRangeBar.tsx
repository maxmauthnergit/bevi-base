'use client'

import { useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  PRESETS, makePresetRange, makeMonthRange,
  fmtDateRange, fmtYM, toYM, offsetYM,
} from '@/lib/date-range'
import type { PresetId } from '@/lib/date-range'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const FS = '0.75rem'

function toInputVal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ChevLeft() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
      <path d="M4.5 0.5L0.5 4.5L4.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevRight() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
      <path d="M0.5 0.5L4.5 4.5L0.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevDown() {
  return (
    <svg width="9" height="5" viewBox="0 0 9 5" fill="none">
      <path d="M0.5 0.5L4.5 4.5L8.5 0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DateRangeBar() {
  const { range, setRange } = useDateRange()

  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const displayYM      = range.month ?? toYM(range.from)
  const monthNavActive = !!range.month
  const isCustom       = !range.preset && !range.month

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

  const navBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '6px 8px', borderRadius: 6,
    color: '#9E9D98', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }

  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: G, fontSize: FS, fontWeight: 500, letterSpacing: '0.02em',
    padding: '5px 11px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: active ? '#111110' : 'transparent',
    color: active ? '#FFFFFF' : '#6B6A64',
    transition: 'all 0.1s',
  })

  const dateInp: React.CSSProperties = {
    fontFamily: G, fontSize: FS, color: '#111110',
    border: '1px solid #E3E2DC', borderRadius: 8, padding: '4px 8px',
    outline: 'none', backgroundColor: '#FFFFFF',
  }

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
      borderRadius: 16, padding: '6px 14px',
      display: 'flex', alignItems: 'center',
      marginBottom: 24,
    }}>

      {/* Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center',
        paddingRight: 16, marginRight: 16,
        borderRight: '1px solid #F0EFE9', flexShrink: 0,
      }}>
        <button style={navBtn} onClick={() => navMonth(-1)}><ChevLeft /></button>
        <span style={{
          fontFamily: G, fontSize: FS, fontWeight: 500,
          color: monthNavActive ? '#111110' : '#C7C6C0',
          minWidth: 72, textAlign: 'center', padding: '0 4px',
          transition: 'color 0.1s',
        }}>
          {fmtYM(displayYM)}
        </span>
        <button style={navBtn} onClick={() => navMonth(+1)}><ChevRight /></button>
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
            <span style={{ color: '#9E9D98', fontFamily: G, fontSize: FS }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={dateInp} />
            <button style={{ ...pill(true), padding: '5px 14px' }} onClick={applyCustom}>Apply</button>
            <button style={{ ...navBtn, color: '#C7C6C0' }} onClick={() => setShowCustom(false)}>✕</button>
          </div>
        ) : (
          <button
            style={{
              ...pill(isCustom),
              display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px',
            }}
            onClick={openCustom}
          >
            <span>{fmtDateRange(range.from, range.to)}</span>
            <span style={{ color: isCustom ? 'rgba(255,255,255,0.5)' : '#C7C6C0', display: 'flex', alignItems: 'center' }}>
              <ChevDown />
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
