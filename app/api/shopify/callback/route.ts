import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ─── Step 2: Receive auth code, verify, exchange for access token ─────────────
// After approving the app on Shopify, you land here with a `code`.
// We exchange it for a permanent offline access token and display it.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const hmac = searchParams.get('hmac')
  const shop = searchParams.get('shop')

  if (!code || !hmac || !shop) {
    return html('❌ Error', 'Missing required parameters from Shopify.', null)
  }

  // ── Verify HMAC signature ───────────────────────────────────────────────────
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!clientSecret) {
    return html('❌ Error', 'Missing SHOPIFY_CLIENT_SECRET env var.', null)
  }

  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    if (key !== 'hmac') params[key] = value
  })

  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  const digest = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex')

  if (digest !== hmac) {
    return html('❌ Error', 'HMAC verification failed — request may be tampered.', null)
  }

  // ── Exchange code for permanent access token ────────────────────────────────
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return html('❌ Error', `Token exchange failed: ${text}`, null)
  }

  const { access_token, scope } = (await tokenRes.json()) as {
    access_token: string
    scope: string
  }

  return html('✓ Shopify Connected', `Store: ${shop}<br>Scopes: ${scope}`, access_token)
}

// ─── HTML response helper ─────────────────────────────────────────────────────

function html(title: string, subtitle: string, token: string | null) {
  const body = token
    ? `
      <p style="color:#888;margin-bottom:8px">
        Copy this token and save it as <code style="color:#fff">SHOPIFY_ACCESS_TOKEN</code>
        in Vercel → Project Settings → Environment Variables:
      </p>
      <pre style="background:#141414;border:1px solid #2a2a2a;padding:16px;
                  border-radius:4px;word-break:break-all;color:#7DEFEF;
                  font-size:0.875rem;margin:0 0 24px">${token}</pre>
      <p style="color:#555;font-size:0.8rem">
        After saving, redeploy on Vercel and the dashboard will pull live Shopify data.
      </p>`
    : `<p style="color:#FF4444">${subtitle}</p>`

  const page = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
</head>
<body style="background:#0A0A0A;color:#fff;
             font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
             padding:48px 40px;max-width:640px;margin:0 auto">
  <p style="font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;
            color:#444;margin-bottom:12px">Bevi Base · Shopify OAuth</p>
  <h1 style="font-size:1.5rem;font-weight:500;color:${token ? '#7DEFEF' : '#FF4444'};
             margin:0 0 8px">${title}</h1>
  <p style="color:#666;font-size:0.875rem;margin:0 0 32px">${token ? subtitle : ''}</p>
  ${body}
</body>
</html>`

  return new NextResponse(page, {
    headers: { 'Content-Type': 'text/html' },
  })
}
