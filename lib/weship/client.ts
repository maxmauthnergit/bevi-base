// ─── WeShip API client ────────────────────────────────────────────────────────
// Auth: session-based — POST /mapi/public/auth/login → token
// Token is cached in memory for 4 hours.
//
// Required env vars:
//   WESHIP_BASE_URL      e.g. https://portal.weship.at  (omit trailing slash)
//   WESHIP_USERNAME
//   WESHIP_PASSWORD

import https from 'https'
import http  from 'http'

// Node's native fetch rejects GET+body (per HTTP spec). WeShip requires a body
// even on GET requests, so we bypass fetch entirely with https.request.
function nodeRequest(url: string, method: string, headers: Record<string, string>, body: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const u   = new URL(url)
    const mod = u.protocol === 'https:' ? https : http
    const buf = Buffer.from(body, 'utf-8')

    const req = mod.request({
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + u.search,
      method,
      headers:  { ...headers, 'Content-Length': buf.length },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c as Buffer))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8')
        resolve({
          ok:     (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          json:   () => Promise.resolve(JSON.parse(text)),
        })
      })
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

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

  const res = await nodeRequest(
    `${baseUrl}/mapi/public/auth/login`, 'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ user: username, password })
  )

  if (!res.ok) throw new Error(`WeShip login failed ${res.status}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as Record<string, any>

  const token: string | undefined =
    data.session_id ?? data.token ?? data.key ?? data.access_token

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
  options: { method?: string; body?: string; next?: { revalidate?: number } } = {}
): Promise<T> {
  const { baseUrl } = getWeShipConfig()
  const token = await getToken()

  const res = await nodeRequest(
    `${baseUrl}${path}`,
    options.method ?? 'GET',
    { 'Content-Type': 'application/json', Cookie: `session_id=${token}` },
    options.body ?? JSON.stringify({})
  )

  if (!res.ok) throw new Error(`WeShip API error ${res.status}`)

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
