'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { LowStockList } from '@/components/inventory/LowStockList'
import type { LowStockItem } from '@/lib/low-stock'
import type { MetaTokenInfo } from '@/lib/meta/token'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** The dashboard's scroll container — the island listens to it, not the window. */
export const SCROLL_CONTAINER_ID = 'dashboard-scroll'

interface Props {
  displayName: string
  initials: string
  avatarUrl?: string
  /** Unawaited — streamed in so the island renders before inventory data lands. */
  lowStock: Promise<LowStockItem[]>
  /** Unawaited, like lowStock. null when the check itself failed. */
  metaToken: Promise<MetaTokenInfo | null>
}

/** The island warns this many days before the Meta token runs out. */
const META_TOKEN_WARNING_DAYS = 10
const META_BLUE = '#0064E0'

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

function MetaIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" style={{ display: 'block' }}>
      <path
        d="M8 7C6.8 4.9 5.6 3.6 4.1 3.6 2.6 3.6 1.3 5.2 1.3 7.3c0 1.6.8 2.6 2 2.6C4.9 9.9 6.2 8.2 8 7Zm0 0c1.2-2.1 2.4-3.4 3.9-3.4 1.5 0 2.8 1.6 2.8 3.7 0 1.6-.8 2.6-2 2.6C11.1 9.9 9.8 8.2 8 7Z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Island label for the token, or null while it is comfortably far from expiry.
 * `short` is the phone variant — the logo already says Meta, and the island
 * has to fit beside the low stock pill on a 360px screen.
 */
function metaTokenAlert(t: MetaTokenInfo | null): { full: string; short: string } | null {
  if (!t) return null
  if (t.reason === 'expired') return { full: 'Meta token expired', short: 'Expired' }
  if (!t.is_valid)            return { full: 'Meta token invalid', short: 'Invalid' }
  if (t.never_expires || t.days_left === null || t.days_left > META_TOKEN_WARNING_DAYS) return null
  if (t.days_left < 0)        return { full: 'Meta token expired',       short: 'Expired' }
  if (t.days_left === 0)      return { full: 'Meta token expires today', short: 'Today' }
  return { full: `Meta token expires in ${t.days_left}d`, short: `${t.days_left}d` }
}

/**
 * Floating top-right island: notifications (Meta token, low stock) + user identity.
 * Fixed to the viewport so page content can scroll all the way to the top
 * instead of hiding behind a full-width bar.
 */
export function UserIsland({ displayName, initials, avatarUrl, lowStock, metaToken }: Props) {
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
            <Notifications
              lowStock={lowStock}
              metaToken={metaToken}
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
 * Notification pills on the island's left: Meta token warning, then low
 * stock. Suspends until both streamed promises resolve; renders nothing —
 * divider included — when neither has anything to say.
 */
function Notifications({
  lowStock, metaToken, open, onToggle, onNavigate,
}: {
  lowStock: Promise<LowStockItem[]>
  metaToken: Promise<MetaTokenInfo | null>
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const items      = use(lowStock)
  const tokenAlert = metaTokenAlert(use(metaToken))
  if (items.length === 0 && !tokenAlert) return null

  return (
    <>
      {tokenAlert && (
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          aria-label={`${tokenAlert.full} — open settings`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 999, marginLeft: 6,
            textDecoration: 'none',
            backgroundColor: 'rgba(0,100,224,0.07)',
          }}
        >
          <MetaIcon color={META_BLUE} />
          <span className="label hidden md:inline" style={{ color: META_BLUE, whiteSpace: 'nowrap' }}>
            {tokenAlert.full}
          </span>
          <span className="label md:hidden" style={{ color: META_BLUE, whiteSpace: 'nowrap' }}>
            {tokenAlert.short}
          </span>
        </Link>
      )}
      {items.length > 0 && (
        <LowStockBell items={items} open={open} onToggle={onToggle} onNavigate={onNavigate} />
      )}
      {/* 10px to the pill; 1px plus the user button's own 9px to the name — the
          same gap on both sides. */}
      <span style={{ width: 1, height: 18, backgroundColor: '#E3E2DC', flexShrink: 0, margin: '0 1px 0 10px' }} />
    </>
  )
}

/** Low stock notification inside the island: badge + expandable detail panel. */
function LowStockBell({
  items, open, onToggle, onNavigate,
}: {
  items: LowStockItem[]
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
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
          padding: '6px 13px', borderRadius: 999, marginLeft: 6,
          border: 'none', cursor: 'pointer',
          backgroundColor: open ? 'rgba(255,68,68,0.10)' : 'rgba(255,68,68,0.06)',
        }}
      >
        <BellIcon color="#DC2626" />
        <span className="label" style={{ color: '#DC2626', whiteSpace: 'nowrap' }}>
          Low Stock Alert
        </span>
      </button>
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
