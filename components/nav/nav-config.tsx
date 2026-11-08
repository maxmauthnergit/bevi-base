// ─── Navigation config ───────────────────────────────────────────────────────
// Single source of truth for the menu. Sidebar (desktop) and BottomNav (mobile)
// both render from here, so every icon is authored exactly once.

import type { ReactNode } from 'react'
import { ARTIFACTS } from '@/data/artifacts'

export interface NavLeaf {
  href:  string
  label: string
}

export type NavNode =
  // `matches`: further routes on which this item counts as active (e.g. the
  // artifact pages listed under /dashboard/artifacts, which keep their own URLs).
  | { kind: 'link';  href: string; label: string; shortLabel?: string; icon: ReactNode; matches?: string[] }
  | { kind: 'group'; id: string;   label: string; shortLabel?: string; icon: ReactNode; children: NavLeaf[] }

// Icons share viewBox "0 0 14 14" and stroke="currentColor" so the same node
// renders at 15px in the sidebar and 16px in the bottom bar.
const iconHome = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <path d="M7 1.5 L13 7 L11.5 7 L11.5 12.5 L2.5 12.5 L2.5 7 L1 7 Z"
      stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)

const iconStatistics = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <path d="M1.5 12.5 L12.5 12.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    <path d="M3.5 12.5 L3.5 8 M7 12.5 L7 4.5 M10.5 12.5 L10.5 6.5"
      stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
)

const iconFinancials = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <rect x="1" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
    <path d="M1 6.5 L13 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" />
    <rect x="2.5" y="8.5" width="3" height="1.8" rx="0.4" stroke="currentColor" strokeWidth="1.05" />
  </svg>
)

const iconInventory = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <rect x="1.5" y="1.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
    <rect x="1.5" y="5.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
    <rect x="1.5" y="9.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
  </svg>
)

const iconArtifacts = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <path d="M4 1.5 L9 1.5 L11.5 4 L11.5 12.5 L4 12.5 Z"
      stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    <path d="M9 1.5 L9 4 L11.5 4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M2.5 3.5 L2.5 13.5 L9.5 13.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const iconSettings = (
  <svg viewBox="0 0 14 14" fill="none" width="100%" height="100%">
    <path d="M6.0 1.6 L8.0 1.6 L8.9 3.7 L11.2 3.5 L12.2 5.1 L10.8 7.0 L12.2 8.9 L11.2 10.5 L8.9 10.3 L8.0 12.4 L6.0 12.4 L5.1 10.3 L2.8 10.5 L1.8 8.9 L3.2 7.0 L1.8 5.1 L2.8 3.5 L5.1 3.7 Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="7" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)

export const NAV: NavNode[] = [
  { kind: 'link', href: '/dashboard', label: 'Overview', icon: iconHome },
  {
    kind: 'group', id: 'statistics', label: 'Statistics', shortLabel: 'Stats', icon: iconStatistics,
    children: [
      { href: '/dashboard/orders',    label: 'Orders'    },
      { href: '/dashboard/sales',          label: 'Sales'          },
      { href: '/dashboard/sales-insights', label: 'Sales Insights' },
      { href: '/dashboard/marketing', label: 'Marketing' },
    ],
  },
  { kind: 'link', href: '/dashboard/financials', label: 'Financials', shortLabel: 'Fin', icon: iconFinancials },
  {
    kind: 'group', id: 'inventory', label: 'Inventory', shortLabel: 'Inv', icon: iconInventory,
    children: [
      { href: '/dashboard/inventory',            label: 'Stock Overview'     },
      { href: '/dashboard/inventory/inbounds',   label: 'Inbounds'           },
      { href: '/dashboard/inventory/calculator', label: 'Inbound Calculator' },
    ],
  },
  {
    kind: 'link', href: '/dashboard/artifacts', label: 'Artifacts', icon: iconArtifacts,
    matches: ARTIFACTS.map(a => a.href),
  },
  { kind: 'link', href: '/dashboard/settings', label: 'Settings', icon: iconSettings },
]

export interface ActiveNav {
  groupId: string | null
  href:    string | null
}

// Longest-prefix match. A plain startsWith would light up "Stock Overview"
// (/dashboard/inventory) while sitting on /dashboard/inventory/inbounds, since
// the parent route is a prefix of its siblings.
export function resolveActive(pathname: string): ActiveNav {
  let bestHref:  string | null = null
  let bestGroup: string | null = null

  let bestLen = -1

  // `route` is what the pathname is matched against; `href` is the nav item
  // that lights up — they differ for a link's extra `matches`.
  function consider(route: string, href: string, groupId: string | null) {
    const hit = route === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === route || pathname.startsWith(route + '/')
    if (!hit) return
    if (route.length > bestLen) {
      bestLen   = route.length
      bestHref  = href
      bestGroup = groupId
    }
  }

  for (const node of NAV) {
    if (node.kind === 'link') {
      consider(node.href, node.href, null)
      for (const route of node.matches ?? []) consider(route, node.href, null)
    } else {
      for (const child of node.children) consider(child.href, child.href, node.id)
    }
  }

  return { groupId: bestGroup, href: bestHref }
}
