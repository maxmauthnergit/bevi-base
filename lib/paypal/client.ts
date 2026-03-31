// ─── PayPal REST API client ───────────────────────────────────────────────────

function getPayPalConfig() {
  const clientId     = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const env          = (process.env.PAYPAL_ENV ?? 'live') as 'sandbox' | 'live'

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing PayPal credentials. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'
    )
  }

  const baseUrl =
    env === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'

  return { clientId, clientSecret, baseUrl }
}

// ─── OAuth2 client-credentials token (short-lived, ~9 h) ─────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token
  }

  const { clientId, clientSecret, baseUrl } = getPayPalConfig()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal OAuth error ${res.status}: ${text}`)
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  _tokenCache = {
    token:     json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return _tokenCache.token
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────

export async function paypalFetch<T>(
  path: string,
  params: Record<string, string> = {},
  options: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T> {
  const { baseUrl } = getPayPalConfig()
  const token = await getAccessToken()

  const qs  = new URLSearchParams(params)
  const url = `${baseUrl}${path}${qs.toString() ? `?${qs}` : ''}`

  const { next, ...rest } = options
  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
    next: next ?? { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface PayPalBalance {
  currency_code: string
  primary:       boolean
  available_balance: { currency_code: string; value: string }
  withheld_balance:  { currency_code: string; value: string } | null
  total_balance:     { currency_code: string; value: string }
}

export interface PayPalBalancesResponse {
  balances:    PayPalBalance[]
  account_id?: string
  as_of_time?: string
}

export interface PayPalTransactionDetail {
  transaction_info: {
    paypal_account_id:      string
    transaction_id:         string
    transaction_event_code: string
    transaction_initiation_date: string
    transaction_updated_date: string
    transaction_amount: { currency_code: string; value: string }
    fee_amount?:        { currency_code: string; value: string }
    transaction_status: string
    transaction_subject?: string
    transaction_note?: string
  }
}

export interface PayPalTransactionsResponse {
  transaction_details:   PayPalTransactionDetail[]
  account_number?:       string
  start_date?:           string
  end_date?:             string
  last_refreshed_datetime?: string
  page?:                 number
  total_items?:          number
  total_pages?:          number
}
