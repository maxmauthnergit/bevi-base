import { NextResponse } from 'next/server'
import { metaFetch } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface DebugTokenResponse {
  data: {
    is_valid: boolean
    expires_at: number   // Unix timestamp; 0 = never expires
    issued_at: number
    scopes: string[]
    app_id: string
    type: string
  }
}

export async function GET() {
  try {
    const token = process.env.META_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN not set' }, { status: 400 })
    }

    const data = await metaFetch<DebugTokenResponse>('/debug_token', {
      input_token: token,
    })

    const { is_valid, expires_at, issued_at, scopes } = data.data
    const expiresAtMs = expires_at ? expires_at * 1000 : null
    const daysLeft    = expiresAtMs
      ? Math.floor((expiresAtMs - Date.now()) / 86_400_000)
      : null

    return NextResponse.json({
      is_valid,
      expires_at:   expiresAtMs,
      issued_at:    issued_at ? issued_at * 1000 : null,
      days_left:    daysLeft,
      never_expires: expires_at === 0,
      scopes,
    })
  } catch (e) {
    const message = (e as Error).message
    // Code 190 is Meta's OAuthException: the token itself was rejected. Report
    // it as a result rather than an error so the settings page can flag it —
    // this is exactly the moment the token needs attention.
    if (message.includes('"code":190')) {
      return NextResponse.json({
        is_valid:      false,
        expires_at:    null,
        issued_at:     null,
        days_left:     null,
        never_expires: false,
        scopes:        [],
        reason:        message.includes('"error_subcode":463') ? 'expired' : 'invalid',
      })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
