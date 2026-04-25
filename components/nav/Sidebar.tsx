'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5 L13 7 L11.5 7 L11.5 12.5 L2.5 12.5 L2.5 7 L1 7 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/sales',
    label: 'Sales',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <polyline points="1.5,11 4.5,7.5 7,9 10,4.5 12.5,5.5"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2.5 1.5 L11.5 1.5 L11.5 11 L9.5 9.5 L7.5 11 L5.5 9.5 L3.5 11 L2.5 10 L2.5 1.5"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M4.5 4.5 L9.5 4.5 M4.5 6.5 L9.5 6.5 M4.5 8 L7.5 8"
          stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Marketing',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.35" />
        <circle cx="7" cy="7" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/financials',
    label: 'Financials',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
        <path d="M1 6.5 L13 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" />
        <rect x="2.5" y="8.5" width="3" height="1.8" rx="0.4" stroke="currentColor" strokeWidth="1.05" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
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
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M6.0 1.6 L8.0 1.6 L8.9 3.7 L11.2 3.5 L12.2 5.1 L10.8 7.0 L12.2 8.9 L11.2 10.5 L8.9 10.3 L8.0 12.4 L6.0 12.4 L5.1 10.3 L2.8 10.5 L1.8 8.9 L3.2 7.0 L1.8 5.1 L2.8 3.5 L5.1 3.7 Z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="7" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 210,
        minWidth: 210,
        backgroundColor: '#111110',
        borderRight: '1px solid #1E1E1C',
      }}
    >
      {/* Logo — height 52 + 32t + 28b = 112px total, matches right-side padding-top */}
      <div
        className="flex items-center"
        style={{ padding: '32px 24px 28px' }}
      >
        <img
          src="/bevi-base-wordmark.png"
          alt="Bevi Base"
          height={52}
          style={{ height: 52, display: 'block', objectFit: 'contain' }}
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = 'none'
            const fallback = el.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <span
          style={{
            display: 'none',
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.375rem',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.15,
          }}
        >
          Bevi Base
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 flex-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 transition-colors',
                active ? 'text-white' : 'text-[#555550] hover:text-[#AAAAAA]',
              )}
              style={{
                borderRadius: 10,
                backgroundColor: active ? '#1E1E1C' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  color: active ? '#7DEFEF' : 'currentColor',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.8125rem',
                  fontWeight: active ? 500 : 400,
                  letterSpacing: '0.01em',
                }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: '#7DEFEF',
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #1E1E1C' }}>
        <p className="label" style={{ color: '#3A3A38', marginBottom: 2 }}>Bevi Bag GmbH</p>
        <p className="label" style={{ color: '#2A2A28' }}>Internal use only</p>
      </div>
    </aside>
  )
}
