'use client'

import { useState, useEffect, useRef } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  PRESETS, makePresetRange, makeMonthRange,
  fmtDateRange, fmtYM, toYM, offsetYM,
} from '@/lib/date-range'
import type { PresetId } from '@/lib/date-range'

const G  = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const FS = '0.75rem'

// ── Grey hierarchy ─────────────────────────────────────────────────────────────
//   #111110  selected / active  (dark pill bg, bold month label)
//   #6B6A64  default interactive (all clickable items when not selected)
//   #9E9D98  auxiliary / decorative (chevrons, "From / To" labels, dividers)

const NAV_BTN: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '6px 8px', borderRadius: 6, flexShrink: 0,
  color: '#9E9D98', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: G, fontSize: FS, fontWeight: 500, letterSpacing: '0.02em',
    padding: '5px 11px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: active ? '#111110' : 'transparent',
    color:           active ? '#FFFFFF' : '#6B6A64',
    transition: 'background 0.1s, color 0.1s',
  }
}

function toDateStr(d: Date): string {
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

// ── Calendar picker overlay ────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_ABBR = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function fmtDisplayDate(ds: string): string {
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CalendarPicker({
  initialFrom, initialTo, onApply, onClose,
}: {
  initialFrom: string
  initialTo:   string
  onApply: (from: string, to: string) => void
  onClose: () => void
}) {
  const startDate = initialFrom ? new Date(initialFrom + 'T12:00:00') : new Date()
  const [vy, setVy] = useState(startDate.getFullYear())
  const [vm, setVm] = useState(startDate.getMonth())
  const [from,  setFrom]  = useState(initialFrom)
  const [to,    setTo]    = useState(initialTo)
  const [phase, setPhase] = useState<'from' | 'to'>('from')
  const [hover, setHover] = useState<string | null>(null)

  function navMonth(delta: number) {
    const next = new Date(vy, vm + delta, 1)
    setVy(next.getFullYear())
    setVm(next.getMonth())
  }

  function mkStr(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function handleDay(ds: string) {
    if (phase === 'from') {
      setFrom(ds)
      setTo('')
      setPhase('to')
    } else {
      if (ds < from) {
        setTo(from)
        setFrom(ds)
      } else {
        setTo(ds)
      }
      setPhase('from')
    }
  }

  const todayStr  = toDateStr(new Date())
  const firstDow  = (new Date(vy, vm, 1).getDay() + 6) % 7
  const daysInMo  = new Date(vy, vm + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMo; d++) cells.push(mkStr(vy, vm, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const canApply  = !!from && !!to

  // Hover preview: show tentative range while picking end date
  const previewFrom = phase === 'to' && hover ? (hover < from ? hover : from) : from
  const previewTo   = phase === 'to' && hover ? (hover < from ? from  : hover) : to

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
      backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
      borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      padding: '20px', width: 296,
      fontFamily: G,
    }}>

      {/* From / To display */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 16,
        border: '1px solid #E3E2DC', borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          flex: 1, padding: '10px 14px',
          backgroundColor: phase === 'from' ? '#F9F9F7' : '#FFFFFF',
          borderRight: '1px solid #E3E2DC',
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 3, fontWeight: 500, letterSpacing: '0.04em' }}>FROM</div>
          <div style={{ fontSize: FS, fontWeight: 600, color: from ? '#111110' : '#C7C6C0' }}>
            {from ? fmtDisplayDate(from) : 'Select'}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '10px 14px',
          backgroundColor: phase === 'to' ? '#F9F9F7' : '#FFFFFF',
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 3, fontWeight: 500, letterSpacing: '0.04em' }}>TO</div>
          <div style={{ fontSize: FS, fontWeight: 600, color: to ? '#111110' : '#C7C6C0' }}>
            {to ? fmtDisplayDate(to) : 'Select'}
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button style={NAV_BTN} onClick={() => navMonth(-1)}><ChevLeft /></button>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111110', letterSpacing: '0.01em' }}>
          {MONTH_NAMES[vm]} {vy}
        </span>
        <button style={NAV_BTN} onClick={() => navMonth(+1)}><ChevRight /></button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_ABBR.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.6875rem',
            fontWeight: 500, color: '#9E9D98', padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((ds, i) => {
          if (!ds) return <div key={`e${i}`} style={{ padding: '5px 0' }} />
          const isStart = ds === previewFrom
          const isEnd   = ds === previewTo && !!previewTo
          const inRange = !!previewFrom && !!previewTo && ds > previewFrom && ds < previewTo
          const isPoint = isStart || isEnd
          const isToday = ds === todayStr

          return (
            <button
              key={ds}
              onClick={() => handleDay(ds)}
              onMouseEnter={() => phase === 'to' && setHover(ds)}
              onMouseLeave={() => setHover(null)}
              style={{
                border: 'none', cursor: 'pointer',
                borderRadius: 7, padding: '5px 0',
                textAlign: 'center', fontSize: FS,
                fontFamily: G, fontWeight: isPoint ? 600 : 400,
                backgroundColor: isPoint ? '#111110' : inRange ? '#F0EFE9' : 'transparent',
                color: isPoint ? '#FFFFFF' : isToday && !inRange ? '#111110' : '#6B6A64',
                boxShadow: isToday && !isPoint ? 'inset 0 0 0 1.5px #E3E2DC' : 'none',
              }}
            >
              {parseInt(ds.split('-')[2])}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0EFE9',
      }}>
        <span style={{ fontSize: '0.6875rem', color: '#9E9D98' }}>
          {phase === 'from' ? 'Select start date' : 'Now pick end date'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onClose} style={{ ...pillStyle(false), padding: '4px 12px', fontSize: '0.6875rem' }}>
            Cancel
          </button>
          <button
            onClick={() => canApply && onApply(from, to)}
            style={{
              ...pillStyle(true), padding: '4px 12px', fontSize: '0.6875rem',
              opacity: canApply ? 1 : 0.35,
              cursor:  canApply ? 'pointer' : 'default',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DateRangeBar ───────────────────────────────────────────────────────────────

export function DateRangeBar() {
  const { range, setRange } = useDateRange()
  const [showCalendar, setShowCalendar] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const displayYM      = range.month ?? toYM(range.from)
  const monthNavActive = !!range.month
  const isCustom       = !range.preset && !range.month

  // Close on outside click
  useEffect(() => {
    if (!showCalendar) return
    function onDown(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showCalendar])

  // Close on Escape
  useEffect(() => {
    if (!showCalendar) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowCalendar(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showCalendar])

  function selectPreset(id: PresetId) {
    setShowCalendar(false)
    setRange(makePresetRange(id))
  }

  function navMonth(delta: number) {
    setShowCalendar(false)
    setRange(makeMonthRange(offsetYM(displayYM, delta)))
  }

  function applyCustom(fromStr: string, toStr: string) {
    const from = new Date(fromStr + 'T00:00:00')
    const to   = new Date(toStr   + 'T23:59:59')
    setRange({ from, to, label: fmtDateRange(from, to) })
    setShowCalendar(false)
  }

  return (
    <div
      ref={barRef}
      style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
        borderRadius: 16, padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center',
        marginBottom: 24,
        position: 'relative',
      }}
    >
      {/* Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center',
        paddingRight: 16, marginRight: 16,
        borderRight: '1px solid #F0EFE9', flexShrink: 0,
      }}>
        <button style={NAV_BTN} onClick={() => navMonth(-1)}><ChevLeft /></button>
        <span style={{
          fontFamily: G, fontSize: FS, fontWeight: 500,
          color: monthNavActive ? '#111110' : '#6B6A64',
          minWidth: 72, textAlign: 'center', padding: '0 4px',
          transition: 'color 0.1s',
        }}>
          {fmtYM(displayYM)}
        </span>
        <button style={NAV_BTN} onClick={() => navMonth(+1)}><ChevRight /></button>
      </div>

      {/* Preset pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.id} style={pillStyle(range.preset === p.id)} onClick={() => selectPreset(p.id as PresetId)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date trigger — size never changes */}
      <div style={{
        paddingLeft: 16, marginLeft: 16,
        borderLeft: '1px solid #F0EFE9', flexShrink: 0,
        position: 'relative',
      }}>
        <button
          style={{
            ...pillStyle(isCustom || showCalendar),
            display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px',
          }}
          onClick={() => setShowCalendar(v => !v)}
        >
          <span>{fmtDateRange(range.from, range.to)}</span>
          <span style={{
            color: (isCustom || showCalendar) ? 'rgba(255,255,255,0.5)' : '#9E9D98',
            display: 'flex', alignItems: 'center',
          }}>
            <ChevDown />
          </span>
        </button>

        {showCalendar && (
          <CalendarPicker
            initialFrom={toDateStr(range.from)}
            initialTo={toDateStr(range.to)}
            onApply={applyCustom}
            onClose={() => setShowCalendar(false)}
          />
        )}
      </div>
    </div>
  )
}
