'use client'

import { inp } from '@/components/ui/formStyles'
import { ChevDown } from '@/components/ui/Chevrons'

/**
 * Native select with the app's own chevron. The browser's arrow sits hard
 * against the right edge and looks nothing like the rest of the controls, so
 * `appearance: none` removes it and the shared ChevDown is placed with the same
 * inset as the field's own padding.
 */
export function Select({
  value,
  onChange,
  children,
  disabled = false,
  style,
}: {
  value:     string
  onChange:  (v: string) => void
  children:  React.ReactNode
  disabled?: boolean
  style?:    React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          ...inp,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          paddingRight: 30,
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: disabled ? '#FAFAF7' : '#FFFFFF',
        }}
      >
        {children}
      </select>
      <span
        aria-hidden
        style={{
          position: 'absolute', top: '50%', right: 11,
          transform: 'translateY(-50%)',
          color: '#9E9D98', display: 'flex',
          pointerEvents: 'none',   // clicks must reach the select underneath
        }}
      >
        <ChevDown />
      </span>
    </div>
  )
}
