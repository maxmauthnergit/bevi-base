'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

interface Props {
  displayName: string
  initials: string
  avatarUrl?: string
}

export function TopBarUser({ displayName, initials, avatarUrl }: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signOut() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
          <span style={{ fontFamily: G, fontSize: '0.8125rem', fontWeight: 500, color: '#111110', lineHeight: 1 }}>
            {displayName}
          </span>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          backgroundColor: '#E3E2DC', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: G, fontSize: '0.625rem', fontWeight: 600, color: '#6B6A64', letterSpacing: '0.02em' }}>
              {initials}
            </span>
          )}
        </div>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
            borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            zIndex: 50, minWidth: 160, overflow: 'hidden',
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
        </>
      )}
    </div>
  )
}
