'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5 L13 7 L11.5 7 L11.5 12.5 L2.5 12.5 L2.5 7 L1 7 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sales',
    label: 'Sales',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <polyline points="1.5,11 4.5,7.5 7,9 10,4.5 12.5,5.5"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M2.5 1.5 L11.5 1.5 L11.5 11 L9.5 9.5 L7.5 11 L5.5 9.5 L3.5 11 L2.5 10 L2.5 1.5"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M4.5 4.5 L9.5 4.5 M4.5 6.5 L9.5 6.5 M4.5 8 L7.5 8"
          stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Mktg',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="7" cy="7" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <rect x="1.5" y="1.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
        <rect x="1.5" y="5.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
        <rect x="1.5" y="9.5" width="11" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.35" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <path d="M6.0 1.6 L8.0 1.6 L8.9 3.7 L11.2 3.5 L12.2 5.1 L10.8 7.0 L12.2 8.9 L11.2 10.5 L8.9 10.3 L8.0 12.4 L6.0 12.4 L5.1 10.3 L2.8 10.5 L1.8 8.9 L3.2 7.0 L1.8 5.1 L2.8 3.5 L5.1 3.7 Z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="7" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.3" />
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
