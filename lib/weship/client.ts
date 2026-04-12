// ─── WeShip API client ────────────────────────────────────────────────────────
// Auth: session-based — POST /mapi/public/auth/login → token
// Token is cached in memory for 4 hours.
//
// Required env vars:
//   WESHIP_BASE_URL      e.g. https://portal.weship.at  (omit trailing slash)
//   WESHIP_USERNAME
//   WESHIP_PASSWORD

function getWeShipConfig() {
  const baseUrl  = process.env.WESHIP_BASE_URL
  const username = process.env.WESHIP_USERNAME
  const password = process.env.WESHIP_PASSWORD

  if (!baseUrl || !username || !password) {
    throw new Error(
      'Missing WeShip credentials. Set WESHIP_BASE_URL, WESHIP_USERNAME, WESHIP_PASSWORD.'
    )
  }

  return { baseUrl, username, password }
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let _cache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (_cache && Date.now() < _cache.expiresAt - 60_000) {
    return _cache.token
  }

  const { baseUrl, username, password } = getWeShipConfig()

  const res = await fetch(`${baseUrl}/mapi/public/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, password }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WeShip login failed ${res.status}: ${text}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as Record<string, any>

  // Try common token field names (DRF: "token"/"key", OAuth: "access_token")
  const token: string | undefined =
    data.token ?? data.key ?? data.access_token ?? data.session_token

  if (!token) {
    throw new Error(
      `WeShip login: no token in response. Keys: ${Object.keys(data).join(', ')}`
    )
  }

  // Cache for 4 hours
  _cache = { token, expiresAt: Date.now() + 4 * 60 * 60 * 1000 }
  return token
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────

export async function weshipFetch<T>(
  path: string,
  options: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T> {
  const { baseUrl } = getWeShipConfig()
  const token = await getToken()

  const { next, ...rest } = options

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      // Try both common auth header formats — server accepts whichever it knows
      Authorization: `Token ${token}`,
      ...(rest.headers ?? {}),
    },
    next: next ?? { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WeShip API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface WeShipStockEntry {
  country: string
  expiry_date: string
  quantity: number
  lot_name: string
}

export interface WeShipProduct {
  id: number
  sku: string
  name: string
  barcode: string
  cost_price: number
  sell_price: number
  weight: number
  on_stock: WeShipStockEntry[]
  outgoing_stock: WeShipStockEntry[]
  is_shippable: boolean
  currency: string
}

export interface WeShipProductsResponse {
  rows: WeShipProduct[]
  total: number
  count_rows: number
}

export interface WeShipOrderLine {
  sku: string
  name: string
  quantity: number
  total_price: number
  state: string
  currency: string
}

export interface WeShipOrder {
  order_id: number
  name: string
  reference: string
  remote_order_id: string
  state: string
  date_done: string
  date_scheduled: string
  order_lines: WeShipOrderLine[]
  shipping_address: {
    name: string
    city: string
    country: string
    zip: string
  }
}

export interface WeShipOrdersResponse {
  rows: WeShipOrder[]
  total: number
  count_rows: number
}
