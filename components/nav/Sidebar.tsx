'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { clsx } from 'clsx'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { NAV, resolveActive } from '@/components/nav/nav-config'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'block', flexShrink: 0 }}>
      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const rowBase: React.CSSProperties = {
  borderRadius: 10,
  textDecoration: 'none',
  width: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
}

const labelBase: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.8125rem',
  letterSpacing: '0.01em',
}

function ActiveDot() {
  return (
    <span style={{
      marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
      backgroundColor: '#7DEFEF', flexShrink: 0,
    }} />
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const active   = resolveActive(pathname)

  // Explicit open/closed state per group. Undefined means "not touched yet",
  // and groups start expanded so every page is one click away.
  const [manuallyOpen, setManuallyOpen] = useState<Record<string, boolean | undefined>>({})

  async function signOut() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
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
            fontFamily: G,
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
        {NAV.map((node) => {
          if (node.kind === 'link') {
            const isActive = active.href === node.href
            return (
              <Link
                key={node.href}
                href={node.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 transition-colors',
                  isActive ? 'text-white' : 'text-[#555550] hover:text-[#AAAAAA]',
                )}
                style={{ ...rowBase, backgroundColor: isActive ? '#1E1E1C' : 'transparent' }}
              >
                <span style={{
                  color: isActive ? '#7DEFEF' : 'currentColor',
                  width: 15, height: 15, display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  {node.icon}
                </span>
                <span style={{ ...labelBase, fontWeight: isActive ? 500 : 400 }}>{node.label}</span>
                {isActive && <ActiveDot />}
              </Link>
            )
          }

          const holdsActive = active.groupId === node.id
          const open        = manuallyOpen[node.id] ?? true

          return (
            <div key={node.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setManuallyOpen(m => ({ ...m, [node.id]: !open }))}
                aria-expanded={open}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 transition-colors',
                  holdsActive ? 'text-white' : 'text-[#555550] hover:text-[#AAAAAA]',
                )}
                style={rowBase}
              >
                <span style={{
                  color: holdsActive ? '#7DEFEF' : 'currentColor',
                  width: 15, height: 15, display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  {node.icon}
                </span>
                <span style={{ ...labelBase, fontWeight: holdsActive ? 500 : 400 }}>{node.label}</span>
                <span style={{ marginLeft: 'auto', color: '#555550', display: 'flex' }}>
                  <Chevron open={open} />
                </span>
              </button>

              {open && (
                <div className="flex flex-col gap-1" style={{ marginTop: 2, marginBottom: 2 }}>
                  {node.children.map(child => {
                    const isActive = active.href === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={clsx(
                          'flex items-center py-1.5 transition-colors',
                          isActive ? 'text-white' : 'text-[#555550] hover:text-[#AAAAAA]',
                        )}
                        style={{
                          ...rowBase,
                          paddingLeft: 42,
                          paddingRight: 12,
                          backgroundColor: isActive ? '#1E1E1C' : 'transparent',
                        }}
                      >
                        <span style={{ ...labelBase, fontSize: '0.75rem', fontWeight: isActive ? 500 : 400 }}>
                          {child.label}
                        </span>
                        {isActive && <ActiveDot />}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E1E1C' }}>
        <p className="label" style={{ color: '#3A3A38', marginBottom: 8 }}>Bevi Bag GmbH</p>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            fontFamily: G,
            fontSize: '0.6875rem', color: '#3A3A38', letterSpacing: '0.04em',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2 L1.5 2 L1.5 10 L4.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 4 L10.5 6 L7.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 6 L10.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
