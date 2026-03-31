import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── Step 1: Redirect to Shopify OAuth authorization ─────────────────────────
// Visit /api/shopify/install to begin the one-time OAuth flow.
// Shopify will redirect back to /api/shopify/callback with an auth code.

const REDIRECT_URI = 'https://bevi-base.vercel.app/api/shopify/callback'
const SCOPES = 'read_orders,read_products,read_inventory,read_analytics'

export async function GET() {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const domain = process.env.SHOPIFY_STORE_DOMAIN

  if (!clientId || !domain) {
    return NextResponse.json(
      { error: 'Missing SHOPIFY_CLIENT_ID or SHOPIFY_STORE_DOMAIN env vars' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state: 'bevi-base-install',
  })

  const authUrl = `https://${domain}/admin/oauth/authorize?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
