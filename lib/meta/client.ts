// ─── Meta Marketing API client ────────────────────────────────────────────────

const META_API_VERSION = 'v21.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

function getMetaConfig() {
  const token     = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID

  if (!token || !accountId) {
    throw new Error(
      'Missing Meta credentials. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.'
    )
  }

  // Normalise account ID — ensure it starts with act_
  const account = accountId.startsWith('act_') ? accountId : `act_${accountId}`
  return { token, account }
}

export async function metaFetch<T>(
  path: string,
  params: Record<string, string> = {},
  options: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T> {
  const { token } = getMetaConfig()

  const qs = new URLSearchParams({ ...params, access_token: token })
  const url = `${META_BASE}${path}?${qs.toString()}`

  const { next, ...rest } = options
  const res = await fetch(url, {
    ...rest,
    next: next ?? { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meta API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export function getAccountId() {
  return getMetaConfig().account
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface MetaInsight {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  cpm: string
  cpc: string
  reach: string
  purchase_roas?: { action_type: string; value: string }[]
  actions?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
}

export interface MetaInsightsResponse {
  data: MetaInsight[]
  paging?: { cursors: { before: string; after: string }; next?: string }
}
