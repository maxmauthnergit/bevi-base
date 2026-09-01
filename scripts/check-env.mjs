// ─── Environment preflight ────────────────────────────────────────────────────
// Runs automatically before `npm run dev`. Loads `.env.local` the same way
// Next.js does and reports what is missing, so a local start fails with a
// readable message instead of a runtime stack trace.
//
// Run on its own with: npm run check:env

import { existsSync } from 'node:fs'
import { join } from 'node:path'

// @next/env is CommonJS, so it comes in as a default export. Imported lazily so
// a missing node_modules produces a readable hint instead of a module error.
let loadEnvConfig
try {
  ;({ loadEnvConfig } = (await import('@next/env')).default)
} catch {
  console.error('\n✗ Dependencies are not installed. Run `npm install` first.\n')
  process.exit(1)
}

const projectDir = process.cwd()
const envFile    = join(projectDir, '.env.local')

const REQUIRED = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',      hint: 'Supabase → Project Settings → API → Project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Supabase → Project Settings → API → anon public key' },
]

const GROUPS = [
  { name: 'Supabase (server)', unlocks: 'bank statements, uploads, anything bypassing RLS',
    keys: ['SUPABASE_SERVICE_ROLE_KEY'] },
  { name: 'Shopify',  unlocks: 'orders, sales, inventory, prices',
    keys: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'] },
  { name: 'Meta Ads', unlocks: 'marketing pages',
    keys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'] },
  { name: 'WeShip',   unlocks: 'shipping costs',
    keys: ['WESHIP_BASE_URL', 'WESHIP_USERNAME', 'WESHIP_PASSWORD'] },
  { name: 'PayPal',   unlocks: 'payment data',
    keys: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'] },
]

if (!existsSync(envFile)) {
  console.error(`
✗ No .env.local found.

  Create one from the template and fill in the values:

      cp .env.example .env.local

  Or, if the project is linked to Vercel, pull the real values:

      npx vercel link
      npx vercel env pull .env.local

  Details: docs/LOCAL_DEV.md
`)
  process.exit(1)
}

// Same loader Next.js uses, so parsing matches exactly.
loadEnvConfig(projectDir, true, { info: () => {}, error: console.error })

const isSet = (key) => Boolean(process.env[key]?.trim())

const missingRequired = REQUIRED.filter(({ key }) => !isSet(key))

if (missingRequired.length > 0) {
  console.error('\n✗ .env.local is missing values the app cannot start without:\n')
  for (const { key, hint } of missingRequired) {
    console.error(`    ${key}\n      → ${hint}`)
  }
  console.error('\n  Details: docs/LOCAL_DEV.md\n')
  process.exit(1)
}

const incomplete = GROUPS
  .map((group) => ({ ...group, missing: group.keys.filter((key) => !isSet(key)) }))
  .filter((group) => group.missing.length > 0)

if (incomplete.length > 0) {
  console.log('\n! Optional integrations without credentials — the rest of the app still runs,')
  console.log('  but these pages will show an error when they fetch:\n')
  for (const { name, unlocks, missing } of incomplete) {
    console.log(`    ${name} (${unlocks}) — missing: ${missing.join(', ')}`)
  }
  console.log('')
}

if (process.env.DEV_AUTH_BYPASS === 'true') {
  console.log('! DEV_AUTH_BYPASS=true — login is skipped in dev. Never set this in production.\n')
}

console.log('✓ Environment looks good — starting Next.js\n')
