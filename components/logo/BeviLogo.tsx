interface BeviLogoProps {
  size?: number
  className?: string
  /** 'white' for light bg, 'black' for dark bg — defaults to 'white' (inverted on dark) */
  color?: string
}

// ─── Bevi B Logo Mark ─────────────────────────────────────────────────────────
// Recreated from the Bevi brand mark:
// - Bold B with thick vertical spine
// - Large white rectangular interior cutout
// - Distinctive C/loop mark inside the cutout

export function BeviLogo({ size = 32, className, color = 'white' }: BeviLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Bevi Logo"
    >
      {/* Outer B shape — bold, near-square */}
      <path
        d="M0 0 H58 C88 0 96 16 96 30 C96 43 90 50 78 53 C92 56 100 65 100 80 C100 97 90 112 60 112 H0 V0 Z"
        fill={color}
      />

      {/* White interior rectangle — the characteristic square cutout */}
      <rect x="28" y="10" width="40" height="92" fill="#0A0A0A" />

      {/* Inner C/loop mark — the Bevi brand mark inside the cutout          */}
      {/* Outer ring of the C mark                                            */}
      <path
        fillRule="evenodd"
        d="
          M62 54
          C62 36 52 26 42 26
          C32 26 22 36 22 50
          L22 62
          C22 76 32 86 44 86
          C54 86 62 78 62 70
          L50 70
          C50 74 48 78 44 78
          C36 78 34 70 34 62
          L34 50
          C34 40 38 34 42 34
          C46 34 50 40 50 48
          L62 54 Z
        "
        fill={color}
      />

      {/* Inner teardrop — the eye / loop inside the C mark */}
      <ellipse cx="44" cy="56" rx="6" ry="9" fill="#0A0A0A" />
    </svg>
  )
}

// ─── Wordmark variant: B + "evi" text ─────────────────────────────────────────

export function BeviWordmark({
  height = 24,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    <div
      className={`flex items-center gap-2 ${className ?? ''}`}
      style={{ height }}
    >
      <BeviLogo size={height} />
      <span
        style={{
          fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: height * 0.75,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'white',
          lineHeight: 1,
        }}
      >
        Bevi
      </span>
    </div>
  )
}
