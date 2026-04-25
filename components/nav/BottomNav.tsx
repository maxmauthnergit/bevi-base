'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      // House / home
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5 L13 7 L11.5 7 L11.5 12.5 L2.5 12.5 L2.5 7 L1 7 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sales',
    label: 'Sales',
    icon: (
      // Ascending bar chart
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <rect x="1.5" y="9" width="2.5" height="4" rx="0.4" fill="currentColor" />
        <rect x="5.75" y="6" width="2.5" height="7" rx="0.4" fill="currentColor" />
        <rect x="10" y="3" width="2.5" height="10" rx="0.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      // Shopping bag
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M3.5 5 L2 12.5 L12 12.5 L10.5 5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M5.5 5 C5.5 2.5 8.5 2.5 8.5 5"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Mktg',
    icon: (
      // Megaphone
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M2 5.5 L2 8.5 L5 8.5 L9.5 12 L9.5 2 L5 5.5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M11 5 C12.3 6 12.3 8 11 9"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      // Isometric 3D box
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M7 2 L12 4.5 L7 7 L2 4.5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M2 4.5 L2 9.5 L7 12 L7 7"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M7 7 L12 4.5 L12 9.5 L7 12"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      // Classic 4-tooth gear
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M5.5 1 L8.5 1 L8.5 3 L11 5.5 L13 5.5 L13 8.5 L11 8.5 L8.5 11 L8.5 13 L5.5 13 L5.5 11 L3 8.5 L1 8.5 L1 5.5 L3 5.5 L5.5 3 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.35" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: '#111110',
        borderTop: '1px solid #1E1E1C',
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(item => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '9px 2px',
              textDecoration: 'none',
            }}
          >
            <span style={{ color: active ? '#7DEFEF' : '#555550', display: 'flex', flexShrink: 0 }}>
              {item.icon}
            </span>
            <span style={{
              fontFamily: G,
              fontSize: '0.4375rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: active ? '#FFFFFF' : '#555550',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}>
              {item.label.toUpperCase()}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
