'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { LowStockList } from '@/components/inventory/LowStockList'
import type { LowStockItem } from '@/lib/low-stock'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** The dashboard's scroll container — the island listens to it, not the window. */
export const SCROLL_CONTAINER_ID = 'dashboard-scroll'

interface Props {
  displayName: string
  initials: string
  avatarUrl?: string
  /** Unawaited — streamed in so the island renders before inventory data lands. */
  lowStock: Promise<LowStockItem[]>
}

function BellIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
      <path
        d="M3.2 5.6a3.8 3.8 0 0 1 7.6 0v2.6l1 1.7H2.2l1-1.7Z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round"
      />
      <path d="M5.6 9.9a1.4 1.4 0 0 0 2.8 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Floating top-right island: low-stock notification + user identity.
 * Fixed to the viewport so page content can scroll all the way to the top
 * instead of hiding behind a full-width bar.
 */
export function UserIsland({ displayName, initials, avatarUrl, lowStock }: Props) {
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [hidden,    setHidden]    = useState(false)
  const router = useRouter()

  const anyOpen = menuOpen || alertOpen
  // An open dropdown pins the island in place — never yank it away mid-read.
  const offscreen = hidden && !anyOpen

  // Hide while scrolling down, bring it back on the way up or at the top.
  useEffect(() => {
    const el: HTMLElement | null = document.getElementById(SCROLL_CONTAINER_ID)
    const target: HTMLElement | Window = el ?? window
    const readY = () => (el ? el.scrollTop : window.scrollY)

    let last  = readY()
    let frame = 0

    function onScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y     = readY()
        const delta = y - last
        if (Math.abs(delta) < 4) return   // ignore jitter, keep accumulating
        last = y
        setHidden(y > 48 && delta > 0)
      })
    }

    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  function closeAll() {
    setMenuOpen(false)
    setAlertOpen(false)
  }

  async function signOut() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Click-outside backdrop */}
      {anyOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={closeAll} />
      )}

      <div
        className="user-island fixed top-3 right-4 md:top-4 md:right-6 lg:top-5 lg:right-10"
        style={{
          zIndex: 60,
          transform:     offscreen ? 'translateY(-160%)' : 'translateY(0)',
          opacity:       offscreen ? 0 : 1,
          pointerEvents: offscreen ? 'none' : 'auto',
        }}
      >
        {/* Island pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E3E2DC',
          borderRadius: 999,
          padding: 4,
          boxShadow: '0 2px 12px rgba(17,17,16,0.08)',
        }}>
          <Suspense fallback={null}>
            <LowStockBell
              lowStock={lowStock}
              open={alertOpen}
              onToggle={() => { setAlertOpen(v => !v); setMenuOpen(false) }}
              onNavigate={closeAll}
            />
          </Suspense>

          {/* User */}
          <button
            onClick={() => { setMenuOpen(v => !v); setAlertOpen(false) }}
            aria-expanded={menuOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '2px 3px 2px 9px', borderRadius: 999,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span className="hidden md:inline" style={{
              fontFamily: G, fontSize: '0.8125rem', fontWeight: 500,
              color: '#111110', lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {displayName}
            </span>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              backgroundColor: '#E3E2DC', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{
                  fontFamily: G, fontSize: '0.625rem', fontWeight: 600,
                  color: '#6B6A64', letterSpacing: '0.02em',
                }}>
                  {initials}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* User menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
            borderRadius: 12, boxShadow: '0 8px 28px rgba(17,17,16,0.12)',
            minWidth: 170, overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EFE9' }}>
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#6B6A64', display: 'block' }}>
                {displayName}
              </span>
            </div>
            <button
              onClick={signOut}
              disabled={loading}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: G, fontSize: '0.8125rem', color: loading ? '#9E9D98' : '#DC2626',
              }}
            >
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Low stock notification inside the island: badge + expandable detail panel.
 * Suspends until the streamed inventory promise resolves; renders nothing
 * when no SKU runs out inside the alert horizon.
 */
function LowStockBell({
  lowStock, open, onToggle, onNavigate,
}: {
  lowStock: Promise<LowStockItem[]>
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const items = use(lowStock)
  if (items.length === 0) return null

  return (
    <>
      <button
        onClick={onToggle}
        aria-label={`Low stock alert — ${items.length} SKU${items.length > 1 ? 's' : ''}`}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          // Roomier than the user half: the pill's own padding is only 4px, so
          // the tinted ground needs its own air before the island edge and
          // the divider.
          padding: '6px 13px', borderRadius: 999,
          border: 'none', cursor: 'pointer',
          backgroundColor: open ? 'rgba(255,68,68,0.10)' : 'rgba(255,68,68,0.06)',
        }}
      >
        <BellIcon color="#DC2626" />
        <span className="label" style={{ color: '#DC2626' }}>
          Low Stock Alert
        </span>
      </button>
      <span style={{ width: 1, height: 18, backgroundColor: '#E3E2DC', flexShrink: 0, margin: '0 6px' }} />

      {/* Details — expanded from the notification */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 'min(380px, calc(100vw - 32px))',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(255, 68, 68, 0.25)',
          borderRadius: 16,
          boxShadow: '0 8px 28px rgba(17,17,16,0.12)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '4px 16px 0', maxHeight: 'min(60vh, 420px)', overflowY: 'auto' }}>
            <LowStockList items={items} />
          </div>

          <Link
            href="/dashboard/inventory"
            onClick={onNavigate}
            style={{
              display: 'block', padding: '10px 16px',
              borderTop: '1px solid #F0EFE9', textDecoration: 'none',
              fontFamily: G, fontSize: '0.75rem', color: '#6B6A64',
            }}
          >
            View inventory →
          </Link>
        </div>
      )}
    </>
  )
}
