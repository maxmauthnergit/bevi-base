'use client'

import { inp } from '@/components/ui/formStyles'
import { ChevDown, ChevUp } from '@/components/ui/Chevrons'

/**
 * Number field with the app's own stepper. The browser's spinner is a grey
 * block that appears on hover and matches nothing else on the page; this one
 * is always there, a hairline column with the same chevrons the date controls
 * use. Arrow keys still step natively — only the drawing is replaced (the
 * native spinner is hidden in globals.css).
 *
 * `value` stays a string so a cleared field stays cleared while typing. An
 * empty field steps from its placeholder, which is the default it shows.
 */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  placeholder,
  integer = false,
  disabled = false,
  style,
}: {
  value:        string | number
  onChange:     (v: string) => void
  step?:        number
  min?:         number
  max?:         number
  placeholder?: string
  /** Whole numbers only: a typed decimal point is dropped. */
  integer?:     boolean
  disabled?:    boolean
  /** Applied to the input; `width` also sizes the wrapper. */
  style?:       React.CSSProperties
}) {
  const str      = value === null || value === undefined ? '' : String(value)
  const decimals = Math.max(0, (String(step).split('.')[1] ?? '').length)

  function bump(dir: 1 | -1) {
    const from = str.trim() === '' ? Number(placeholder) || 0 : Number(str) || 0
    let next = from + dir * step
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(next.toFixed(decimals))
  }

  const { width, ...inputStyle } = style ?? {}

  return (
    <div style={{ position: 'relative', width: width ?? '100%' }}>
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        step={step} min={min} max={max}
        placeholder={placeholder}
        disabled={disabled}
        value={str}
        onChange={e => onChange(integer ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
        style={{ ...inp, textAlign: 'right', ...inputStyle, width: '100%', paddingRight: 30 }}
      />
      <div style={{
        position: 'absolute', top: 1, bottom: 1, right: 1, width: 22,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid #EDECEA',
        borderRadius: '0 7px 7px 0', overflow: 'hidden',
      }}>
        <button type="button" data-static tabIndex={-1} aria-label="Increase" disabled={disabled}
          onMouseDown={e => e.preventDefault()} onClick={() => bump(1)} style={stepBtn}>
          <ChevUp />
        </button>
        <button type="button" data-static tabIndex={-1} aria-label="Decrease" disabled={disabled}
          onMouseDown={e => e.preventDefault()} onClick={() => bump(-1)} style={stepBtn}>
          <ChevDown />
        </button>
      </div>
    </div>
  )
}

const stepBtn: React.CSSProperties = {
  flex: 1, border: 'none', background: 'none', padding: 0, margin: 0,
  cursor: 'pointer', color: '#9E9D98',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
