/**
 * Shimmering placeholders shown while data is in flight, so a loading card has
 * the same shape as the card that replaces it and the layout does not jump.
 *
 * The shimmer itself lives in globals.css as `.skeleton` (and is disabled under
 * prefers-reduced-motion).
 */

export function Skeleton({
  width = '100%',
  height = 12,
  radius = 6,
  className,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  className?: string
}) {
  return (
    <div
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  )
}

/** Card-shaped placeholder: a label line plus `lines` bar rows. */
export function SkeletonCard({
  height,
  lines = 4,
}: {
  height?: number
  lines?: number
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E3E2DC',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        padding: 24,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Skeleton width={110} height={9} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Skeleton width={`${45 + ((i * 13) % 30)}%`} height={9} />
            <Skeleton width={54} height={9} />
          </div>
          <Skeleton height={4} radius={2} />
        </div>
      ))}
    </div>
  )
}

/** Placeholder for a chart area: faux plot region with an axis line beneath. */
export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading chart">
      <Skeleton height={height} radius={12} />
    </div>
  )
}
