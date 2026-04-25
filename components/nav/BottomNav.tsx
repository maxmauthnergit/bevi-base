'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <rect x="0" y="0" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="8" y="0" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="0" y="8" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="8" y="8" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sales',
    label: 'Sales',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <path d="M1 10 L4 6 L7 8 L10 3 L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 4.5 H10 M4 7 H10 M4 9.5 H7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Marketing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 4 L7 7 L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
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
              gap: 4, padding: '10px 0',
              textDecoration: 'none',
              color: active ? '#FFFFFF' : '#555550',
            }}
          >
            <span style={{ color: active ? '#7DEFEF' : '#555550', display: 'flex' }}>
              {item.icon}
            </span>
            <span style={{
              fontFamily: G, fontSize: '0.5rem', fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: active ? '#FFFFFF' : '#555550',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
