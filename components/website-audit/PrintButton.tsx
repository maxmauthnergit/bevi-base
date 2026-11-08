'use client'

import { btn } from '@/components/ui/formStyles'

export function PrintButton() {
  return (
    <button type="button" className="wa-no-print" style={btn} onClick={() => window.print()}>
      Drucken / PDF
    </button>
  )
}
