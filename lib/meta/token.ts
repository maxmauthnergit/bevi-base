import { metaFetch } from '@/lib/meta/client'

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

export interface MetaTokenInfo {
  is_valid:      boolean
  expires_at:    number | null
  issued_at:     number | null
  days_left:     number | null
  never_expires: boolean
  scopes:        string[]
  /** Set when Meta rejected the token outright (OAuthException 190). */
  reason?:       'expired' | 'invalid'
}

/**
 * Lifetime of META_ACCESS_TOKEN via /debug_token. A token Meta rejects
 * (code 190) is reported as a result rather than thrown — that is exactly the
 * case the UI has to flag. Anything else (missing env var, network) throws.
 */
export async function getMetaTokenInfo(
  options: { next?: { revalidate?: number } } = {}
): Promise<MetaTokenInfo> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN not set')

  try {
    const data = await metaFetch<DebugTokenResponse>('/debug_token', { input_token: token }, options)

    const { is_valid, expires_at, issued_at, scopes } = data.data
    const expiresAtMs = expires_at ? expires_at * 1000 : null
    const daysLeft    = expiresAtMs
      ? Math.floor((expiresAtMs - Date.now()) / 86_400_000)
      : null

    return {
      is_valid,
      expires_at:    expiresAtMs,
      issued_at:     issued_at ? issued_at * 1000 : null,
      days_left:     daysLeft,
      never_expires: expires_at === 0,
      scopes,
    }
  } catch (e) {
    const message = (e as Error).message
    if (!message.includes('"code":190')) throw e
    return {
      is_valid:      false,
      expires_at:    null,
      issued_at:     null,
      days_left:     null,
      never_expires: false,
      scopes:        [],
      reason:        message.includes('"error_subcode":463') ? 'expired' : 'invalid',
    }
  }
}
