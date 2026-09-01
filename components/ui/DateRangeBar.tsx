'use client'

import { useState, useEffect, useRef } from 'react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  PRESETS, makePresetRange, makeMonthRange,
  fmtDateRange, fmtYM, toYM, offsetYM,
} from '@/lib/date-range'
import type { PresetId } from '@/lib/date-range'

import {
  G, FS, NAV_BTN, pillStyle, POPOVER, MONTH_NAMES, DAY_ABBR,
  toDateStr, fmtDisplayDate, monthCells, dayCellStyle,
} from '@/components/ui/calendar-styles'
import { ChevLeft, ChevRight, ChevDown } from '@/components/ui/Chevrons'

// ── Calendar picker overlay ──────────────────────────────────────────────────

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

  const todayStr = toDateStr(new Date())
  const cells    = monthCells(vy, vm)

  const canApply  = !!from && !!to

  // Hover preview: show tentative range while picking end date
  const previewFrom = phase === 'to' && hover ? (hover < from ? hover : from) : from
  const previewTo   = phase === 'to' && hover ? (hover < from ? from  : hover) : to

  return (
    <div style={{ ...POPOVER, top: 'calc(100% + 8px)', right: 0 }}>

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
              style={dayCellStyle({ selected: isPoint, inRange, isToday })}
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
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

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

  if (isMobile) {
    return (
      <div ref={barRef} style={{ marginBottom: 16, position: 'relative' }}>
        {/* Row 1: month nav + custom date */}
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
          borderRadius: '16px 16px 0 0', padding: '8px 12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #F0EFE9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={NAV_BTN} onClick={() => navMonth(-1)}><ChevLeft /></button>
            <span style={{ fontFamily: G, fontSize: FS, fontWeight: 500, color: monthNavActive ? '#111110' : '#6B6A64', minWidth: 64, textAlign: 'center' }}>
              {fmtYM(displayYM)}
            </span>
            <button style={NAV_BTN} onClick={() => navMonth(+1)}><ChevRight /></button>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...pillStyle(isCustom || showCalendar), display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: '0.6875rem' }}
              onClick={() => setShowCalendar(v => !v)}
            >
              <span>{fmtDateRange(range.from, range.to)}</span>
              <span style={{ color: (isCustom || showCalendar) ? 'rgba(255,255,255,0.5)' : '#9E9D98', display: 'flex' }}><ChevDown /></span>
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
        {/* Row 2: scrollable presets */}
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
          borderTop: 'none', borderRadius: '0 0 16px 16px',
          padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 2,
          overflowX: 'auto', flexWrap: 'nowrap',
          scrollbarWidth: 'none',
        }}>
          {PRESETS.map(p => (
            <button key={p.id} style={{ ...pillStyle(range.preset === p.id), whiteSpace: 'nowrap', fontSize: '0.6875rem', padding: '4px 9px' }} onClick={() => selectPreset(p.id as PresetId)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={barRef}
      style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
        borderRadius: 16, padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center',
        marginBottom: 16,
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
