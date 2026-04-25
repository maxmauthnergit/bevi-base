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
        <rect x="1.5" y="9" width="2.5" height="4" rx="0.5" fill="currentColor" />
        <rect x="5.75" y="6" width="2.5" height="7" rx="0.5" fill="currentColor" />
        <rect x="10" y="3" width="2.5" height="10" rx="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/orders',
    label: 'Orders',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M3.5 5 L2 12.5 L12 12.5 L10.5 5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M5.5 5 C5.5 2.5 8.5 2.5 8.5 5"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/marketing',
    label: 'Marketing',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2 5.5 L2 8.5 L5 8.5 L9.5 12 L9.5 2 L5 5.5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M11 5 C12.3 6 12.3 8 11 9"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/financials',
    label: 'Financials',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M10 4 C9 2 6.5 1.5 5 2.5 C3 3.8 2.5 6 2.5 7.5 C2.5 9 3 10.5 5 11.5 C6.5 12.2 9 11.5 10 10"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" fill="none" />
        <path d="M2.5 6.5 L9 6.5 M2.5 8.5 L8.5 8.5"
          stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/inventory',
    label: 'Inventory',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M7 2 L12 4.5 L7 7 L2 4.5 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M2 4.5 L2 9.5 L7 12 L7 7"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M7 7 L12 4.5 L12 9.5 L7 12"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M5.5 1 L8.5 1 L8.5 3 L11 5.5 L13 5.5 L13 8.5 L11 8.5 L8.5 11 L8.5 13 L5.5 13 L5.5 11 L3 8.5 L1 8.5 L1 5.5 L3 5.5 L5.5 3 Z"
          stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.35" />
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
