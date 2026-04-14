'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 10 L4 6 L7 8 L10 3 L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 4.5 H10 M4 7 H10 M4 9.5 H7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Marketing',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 4 L7 7 L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/financials',
    label: 'Financials',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="8" width="2.5" height="5" rx="1" fill="currentColor" />
        <rect x="5.5" y="5" width="2.5" height="8" rx="1" fill="currentColor" />
        <rect x="10" y="2" width="2.5" height="11" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 1 L7 3 M7 11 L7 13 M1 7 L3 7 M11 7 L13 7 M2.5 2.5 L4 4 M10 10 L11.5 11.5 M11.5 2.5 L10 4 M4 10 L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
