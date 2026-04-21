'use client'

import { usePathname } from 'next/navigation'
import { DateRangeBar } from './DateRangeBar'

const HIDDEN_ON = ['/dashboard/inventory', '/dashboard/settings']

export function DashboardDateBar() {
  const pathname = usePathname()
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null
  return (
    <div style={{ padding: '0 40px' }}>
      <DateRangeBar />
    </div>
  )
}
