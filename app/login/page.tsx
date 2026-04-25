'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#111110',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

        {/* Logo / wordmark */}
        <div style={{ textAlign: 'center' }}>
          <img
            src="/bevi-base-wordmark.png"
            alt="Bevi Base"
            style={{ height: 48, display: 'block', margin: '0 auto', objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <p style={{ fontFamily: G, fontSize: '0.75rem', color: '#3A3A38', marginTop: 12, letterSpacing: '0.04em' }}>
            Internal dashboard — Bevi Bag GmbH
          </p>
        </div>

        {/* Card */}
        <div style={{
          width: '100%',
          backgroundColor: '#1A1A18',
          border: '1px solid #2A2A28',
          borderRadius: 20,
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div>
            <h1 style={{ fontFamily: G, fontSize: '1.25rem', fontWeight: 600, color: '#F5F4F0', margin: 0, lineHeight: 1.2 }}>
              Sign in
            </h1>
            <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#555550', marginTop: 6, lineHeight: 1.5 }}>
              Use your Google account to access the dashboard.
            </p>
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 20px',
              backgroundColor: loading ? '#1E1E1C' : '#FFFFFF',
              border: '1px solid #E3E2DC',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: G,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: loading ? '#555550' : '#111110',
              transition: 'all 0.15s',
            }}
          >
            {/* Google logo */}
            {!loading && (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p style={{ fontFamily: G, fontSize: '0.75rem', color: '#DC2626', textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#2A2A28', textAlign: 'center' }}>
          Access restricted to authorised users only.
        </p>
      </div>
    </div>
  )
}
