'use client'

import { useEffect, useRef, useState } from 'react'
import {
  G, FS, NAV_BTN, pillStyle, POPOVER, MONTH_NAMES, DAY_ABBR,
  toDateStr, fmtDisplayDate, monthCells, dayCellStyle,
} from '@/components/ui/calendar-styles'
import { ChevLeft, ChevRight, ChevDown } from '@/components/ui/Chevrons'

/**
 * Single-date field with the same calendar as the dashboard's DateRangeBar.
 *
 * The range bar's own picker is a two-value state machine wired to the global
 * date-range context, so it can't serve a plain form field; the two share their
 * look through components/ui/calendar-styles instead.
 *
 * `value` is a 'YYYY-MM-DD' string, empty when unset. `onChange` receives the
 * same, and '' when the date is cleared.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  align = 'left',
}: {
  value:        string
  onChange:     (next: string) => void
  placeholder?: string
  disabled?:    boolean
  align?:       'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const anchor = value ? new Date(value + 'T12:00:00') : new Date()
  const [vy, setVy] = useState(anchor.getFullYear())
  const [vm, setVm] = useState(anchor.getMonth())

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function openPicker() {
    if (disabled) return
    // Jump the calendar to the selected month, or to today when unset.
    const d = value ? new Date(value + 'T12:00:00') : new Date()
    setVy(d.getFullYear())
    setVm(d.getMonth())
    setOpen(o => !o)
  }

  function navMonth(delta: number) {
    const next = new Date(vy, vm + delta, 1)
    setVy(next.getFullYear())
    setVm(next.getMonth())
  }

  function pick(ds: string) {
    onChange(ds)
    setOpen(false)
  }

  const todayStr = toDateStr(new Date())
  const cells    = monthCells(vy, vm)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button data-static
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-expanded={open}
        style={{
          fontFamily: G,
          fontSize: '0.8125rem',
          color: value ? '#111110' : '#9E9D98',
          border: '1px solid #E3E2DC',
          borderRadius: 8,
          padding: '5px 10px',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          backgroundColor: disabled ? '#FAFAF7' : '#FFFFFF',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value ? fmtDisplayDate(value) : placeholder}
        </span>
        <span style={{ color: '#9E9D98', display: 'flex', flexShrink: 0 }}><ChevDown /></span>
      </button>

      {open && (
        <div style={{
          ...POPOVER,
          top: 'calc(100% + 6px)',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button data-static type="button" style={NAV_BTN} onClick={() => navMonth(-1)}><ChevLeft /></button>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111110', letterSpacing: '0.01em' }}>
              {MONTH_NAMES[vm]} {vy}
            </span>
            <button data-static type="button" style={NAV_BTN} onClick={() => navMonth(+1)}><ChevRight /></button>
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
              return (
                <button data-static
                  key={ds}
                  type="button"
                  onClick={() => pick(ds)}
                  style={dayCellStyle({
                    selected: ds === value,
                    inRange:  false,
                    isToday:  ds === todayStr,
                  })}
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
            <button data-static
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ ...pillStyle(false), padding: '4px 12px', fontSize: '0.6875rem' }}
            >
              Clear
            </button>
            <button data-static
              type="button"
              onClick={() => pick(todayStr)}
              style={{ ...pillStyle(true), padding: '4px 12px', fontSize: '0.6875rem' }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Read-only twin of the trigger, for computed dates the user cannot edit. */
export function DateReadout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: G,
      fontSize: FS,
      color: '#6B6A64',
      border: '1px solid #E3E2DC',
      borderRadius: 8,
      padding: '6px 10px',
      backgroundColor: '#FAFAF7',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {children}
    </div>
  )
}
