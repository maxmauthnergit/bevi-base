// One icon and one colour per shipping mode, used wherever a mode is named:
// the calculator's comparison, timeline, forecast and hand-over, the chart, and
// the inbounds list. Keeping them together is what lets a reader follow a mode
// across the page — the blue plane on the chart is the blue plane in the table.

import type { ShipMode } from '@/lib/inbounds'
import { shipModeLabel } from '@/lib/inbounds'

/**
 * Hues from the validated categorical palette — the app's own chart colours put
 * Air and Road at ΔE 10.5 for normal vision, close enough to be unreadable.
 * Assigned by mode, never by rank, so filtering modes out never repaints the
 * survivors.
 */
export const MODE_COLOR: Record<ShipMode, string> = {
  air:   '#2a78d6',
  truck: '#eb6834',
  train: '#1baf7a',
  sea:   '#eda100',
}

export function modeColor(mode: string): string {
  return MODE_COLOR[mode as ShipMode] ?? '#9E9D98'
}

const STROKE = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const

/** 14px outline icon, same stroke as TrashIcon. Colour comes from the parent. */
export function ShipModeIcon({ mode, size = 14 }: { mode: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', style: { display: 'block', flexShrink: 0 } }
  switch (mode) {
    case 'air':
      return (
        <svg {...common}>
          <path d="M7 1.2c.5 0 .9.4.9.9v3.4l4.6 2.8v1.3L7.9 8.2v2.6l1.3 1v.9L7 12.1l-2.2.6v-.9l1.3-1V8.2L1.5 9.6V8.3l4.6-2.8V2.1c0-.5.4-.9.9-.9Z" {...STROKE} />
        </svg>
      )
    case 'truck':
      return (
        <svg {...common}>
          <path d="M1.2 3.2h7.2v6.4H1.2Z" {...STROKE} />
          <path d="M8.4 5.2h2.6l1.8 2.2v2.2H8.4" {...STROKE} />
          <circle cx="3.6" cy="10.6" r="1.2" {...STROKE} />
          <circle cx="10.4" cy="10.6" r="1.2" {...STROKE} />
        </svg>
      )
    case 'train':
      return (
        <svg {...common}>
          <rect x="3" y="1.6" width="8" height="8.2" rx="1.8" {...STROKE} />
          <path d="M3 5.6h8" {...STROKE} />
          <path d="M5.4 7.6h.01M8.6 7.6h.01" {...STROKE} strokeWidth="1.8" />
          <path d="M4.8 9.8 3.4 12.4M9.2 9.8l1.4 2.6M4.4 12.4h5.2" {...STROKE} />
        </svg>
      )
    case 'sea':
      return (
        <svg {...common}>
          <path d="M2.2 8.4 7 6.6l4.8 1.8-1 2.6H3.2Z" {...STROKE} />
          <path d="M4.2 6.9V3.6h5.6v3.3M7 3.6V1.8" {...STROKE} />
          <path d="M1.4 12.2c.9.6 1.9.6 2.8 0 .9.6 1.9.6 2.8 0 .9.6 1.9.6 2.8 0 .9.6 1.9.6 2.8 0" {...STROKE} />
        </svg>
      )
    default:
      return null
  }
}

/**
 * Icon + name in the mode's colour. `label` overrides the name when the caller
 * already has it (the calculator's results carry their own).
 */
export function ShipModeLabel({
  mode, label, color = true, size,
}: {
  mode:   string
  label?: string
  /** False keeps the icon in the mode colour but the text in ink. */
  color?: boolean
  size?:  number
}) {
  const hue = modeColor(mode)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ color: hue, display: 'inline-flex' }}><ShipModeIcon mode={mode} size={size} /></span>
      <span style={{ color: color ? hue : undefined }}>{label ?? shipModeLabel(mode)}</span>
    </span>
  )
}
