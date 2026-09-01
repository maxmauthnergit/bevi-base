// ─── Environment preflight ────────────────────────────────────────────────────
// Loads `.env.local` the same way Next.js does and reports what is missing, so a
// local start fails with a readable message instead of a runtime stack trace.
//
// Used by scripts/setup.mjs, and runnable on its own with `npm run check:env`.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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

export function checkEnv() {
  const projectDir = process.cwd()

  if (!existsSync(join(projectDir, '.env.local'))) {
    console.error(`
\x1b[31m✗ No .env.local found.\x1b[0m

  Run \`npm run dev\` — it creates the file for you. To do it by hand:

      cp .env.example .env.local

  Details: docs/LOCAL_DEV.md
`)
    process.exit(1)
  }

  loadEnvConfig(projectDir, true, { info: () => {}, error: console.error })

  const isSet = (key) => Boolean(process.env[key]?.trim())

  const missingRequired = REQUIRED.filter(({ key }) => !isSet(key))
  if (missingRequired.length > 0) {
    console.error('\n\x1b[31m✗ .env.local is missing values the app cannot start without:\x1b[0m\n')
    for (const { key, hint } of missingRequired) {
      console.error(`    ${key}\n      → ${hint}`)
    }
    console.error(`
  Fill them in, or let Vercel supply them:

      npm run env:pull

  Details: docs/LOCAL_DEV.md
`)
    process.exit(1)
  }

  const incomplete = GROUPS
    .map((group) => ({ ...group, missing: group.keys.filter((key) => !isSet(key)) }))
    .filter((group) => group.missing.length > 0)

  if (incomplete.length > 0) {
    console.log('\n\x1b[33m!\x1b[0m Integrations without credentials — the app still runs, but these')
    console.log('  pages will show an error when they fetch:\n')
    for (const { name, unlocks, missing } of incomplete) {
      console.log(`    ${name} (${unlocks}) — missing: ${missing.join(', ')}`)
    }
    console.log('')
  }

  if (process.env.DEV_AUTH_BYPASS === 'true') {
    console.log('\x1b[33m!\x1b[0m DEV_AUTH_BYPASS=true — the Google login is skipped locally.')
    console.log('  \x1b[2mProduction builds ignore this flag.\x1b[0m\n')
  }
}

// @next/env is CommonJS, so it comes in as a default export. Imported lazily so
// a missing node_modules produces a readable hint instead of a module error.
let loadEnvConfig
try {
  ;({ loadEnvConfig } = (await import('@next/env')).default)
} catch {
  console.error('\n\x1b[31m✗ Dependencies are not installed.\x1b[0m Run `npm install` first.\n')
  process.exit(1)
}

// Invoked directly (`node scripts/check-env.mjs`) rather than imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkEnv()
  console.log('\x1b[32m✓ Environment looks good\x1b[0m\n')
}
