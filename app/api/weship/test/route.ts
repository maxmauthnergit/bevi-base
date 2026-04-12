import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function login(): Promise<{ token: string; raw: unknown }> {
  const baseUrl  = process.env.WESHIP_BASE_URL!
  const username = process.env.WESHIP_USERNAME!
  const password = process.env.WESHIP_PASSWORD!

  const res = await fetch(`${baseUrl}/mapi/public/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, password }),
    cache: 'no-store',
  })
  const data = await res.json() as Record<string, string>
  const token = data.session_id ?? data.token ?? data.key ?? data.access_token ?? ''
  return { token, raw: data }
}

async function probe(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* keep text */ }
    return { status: res.status, ok: res.ok, body }
  } catch (e) {
    return { status: 0, ok: false, body: String(e) }
  }
}

export async function GET() {
  const baseUrl = process.env.WESHIP_BASE_URL!
  const { token, raw: loginRaw } = await login()
  const url = `${baseUrl}/mapi/product/search`

  const ct = 'application/json'
  const formats: { name: string; headers: Record<string, string> }[] = [
    { name: 'Cookie: session_id',        headers: { Cookie: `session_id=${token}`, 'Content-Type': ct } },
    { name: 'Cookie: session',           headers: { Cookie: `session=${token}`,    'Content-Type': ct } },
    { name: 'Authorization: Token',      headers: { Authorization: `Token ${token}`,  'Content-Type': ct } },
    { name: 'Authorization: Bearer',     headers: { Authorization: `Bearer ${token}`, 'Content-Type': ct } },
    { name: 'X-Session-ID header',       headers: { 'X-Session-ID': token,            'Content-Type': ct } },
    { name: 'No auth (check if public)', headers: { 'Content-Type': ct } },
  ]

  const results = await Promise.all(
    formats.map(async (f) => ({ format: f.name, ...(await probe(url, f.headers)) }))
  )

  return NextResponse.json({ loginRaw, token_length: token.length, url, results })
}
