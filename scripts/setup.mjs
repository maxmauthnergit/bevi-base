// ─── Local bootstrap ──────────────────────────────────────────────────────────
// Brings the project into a runnable state without any manual steps. Idempotent:
// every step checks first and skips when there is nothing to do, so this can run
// on every `npm run dev` and normally costs a few milliseconds.
//
//   1. Node version
//   2. dependencies        → npm install (only when out of date)
//   3. .env.local          → pulled from Vercel, or created from .env.example
//   4. required variables  → readable error instead of a runtime crash

import { spawnSync } from 'node:child_process'
import { existsSync, statSync, copyFileSync, appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root     = process.cwd()
const envFile  = join(root, '.env.local')
const template = join(root, '.env.example')

const c = {
  dim:  (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red:  (s) => `\x1b[31m${s}\x1b[0m`,
  green:(s) => `\x1b[32m${s}\x1b[0m`,
  amber:(s) => `\x1b[33m${s}\x1b[0m`,
}

const step = (msg) => console.log(c.dim(`  · ${msg}`))
const ok   = (msg) => console.log(c.green(`  ✓ ${msg}`))
const warn = (msg) => console.log(c.amber(`  ! ${msg}`))

function fail(title, body) {
  console.error(`\n${c.red(`✗ ${title}`)}\n${body}\n`)
  process.exit(1)
}

// Runs a command with the terminal attached, so interactive logins work.
function run(cmd, args, { optional = false } = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.status !== 0 && !optional) {
    fail(`\`${cmd} ${args.join(' ')}\` failed.`, '  See the output above.')
  }
  return res.status === 0
}

// ─── 1. Node version ──────────────────────────────────────────────────────────

const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  fail(
    `Node.js ${process.versions.node} is too old — version 20 or newer is required.`,
    '  Install the LTS version from https://nodejs.org and try again.',
  )
}

// ─── 2. Dependencies ──────────────────────────────────────────────────────────
// npm maintains node_modules/.package-lock.json; when it is older than the real
// lockfile, the installed tree is stale.

const lock          = join(root, 'package-lock.json')
const installedLock = join(root, 'node_modules', '.package-lock.json')

const needsInstall =
  !existsSync(installedLock) ||
  (existsSync(lock) && statSync(lock).mtimeMs > statSync(installedLock).mtimeMs)

if (needsInstall) {
  step('Installing dependencies (first run takes a minute)…')
  run('npm', ['install', '--no-audit', '--no-fund'])
  ok('Dependencies installed')
}

// ─── 3. .env.local ────────────────────────────────────────────────────────────

if (!existsSync(envFile)) {
  step('No .env.local yet — fetching the credentials from Vercel…')
  console.log(c.dim('    A browser window may open so you can log in. This happens once.\n'))

  // `vercel link` is safe to re-run; it is a no-op once .vercel/project.json exists.
  const linked = run('npx', ['--yes', 'vercel@latest', 'link', '--yes'], { optional: true })
  const pulled = linked &&
    run('npx', ['--yes', 'vercel@latest', 'env', 'pull', '.env.local'], { optional: true })

  if (pulled && existsSync(envFile)) {
    ok('Credentials written to .env.local')
  } else {
    warn('Could not reach Vercel — falling back to the template.')
    copyFileSync(template, envFile)
  }

  // Skip the Google login locally by default, so the first start works without
  // touching the Supabase dashboard. Delete the line to test the real login.
  if (!/^\s*DEV_AUTH_BYPASS=/m.test(readFileSync(envFile, 'utf8'))) {
    appendFileSync(
      envFile,
      '\n# Added by scripts/setup.mjs — skips the Google login locally.\n' +
      '# Ignored by any production build. Remove this line to test the real login\n' +
      '# (requires http://localhost:3000/** in the Supabase redirect URLs).\n' +
      'DEV_AUTH_BYPASS=true\n',
    )
    ok('Login bypass enabled for local development')
  }
}

// ─── 4. Required variables ────────────────────────────────────────────────────

const { checkEnv } = await import('./check-env.mjs')
checkEnv()
