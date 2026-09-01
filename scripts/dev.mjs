// ─── `npm run dev` ────────────────────────────────────────────────────────────
// Bootstraps the project if needed, starts the Next.js dev server, and opens the
// browser once it is actually serving. Pass extra flags straight through:
//
//   npm run dev -- -p 3001
//
// Set NO_OPEN=1 to keep the browser closed.

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { platform } from 'node:process'

await import('./setup.mjs')

// Run the Next.js CLI directly with this Node binary rather than through npx or
// a shell, so there is no intermediate process between this wrapper and the
// server to swallow signals or slow down the start.
const nextCli = createRequire(import.meta.url).resolve('next/dist/bin/next')

// `detached` puts the dev server in its own process group, so stopping this
// wrapper can take the whole tree down with it — otherwise Next.js survives and
// keeps holding port 3000. Its stdin is not connected for the same reason: a
// background process group reading the terminal would be suspended by SIGTTIN.
const detached = platform !== 'win32'

const args  = process.argv.slice(2)
const child = spawn(process.execPath, [nextCli, 'dev', ...args], {
  stdio: ['ignore', 'pipe', 'inherit'],
  detached,
})

// Next.js prints the address it settled on — which is not always 3000, since it
// picks the next free port when one is taken. Wait for that line rather than
// guessing, then open it once.
let opened = false

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  if (opened || process.env.NO_OPEN) return

  const url = String(chunk).match(/Local:\s+(https?:\/\/\S+)/)?.[1]
  if (!url) return

  opened = true
  const [cmd, cmdArgs] =
    platform === 'darwin' ? ['open',     [url]]     :
    platform === 'win32'  ? ['cmd',      ['/c', 'start', '', url]] :
                            ['xdg-open', [url]]

  // Opening the browser is a convenience — a headless or locked-down machine
  // should not take the dev server down with it.
  try {
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
  } catch { /* ignore */ }
})

let stopping = false

function stop(signal) {
  if (stopping) return
  stopping = true

  // Negative pid targets the process group, so Next.js' own workers go too.
  try {
    if (detached) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch { /* already gone */ }

  // Anything still standing after the grace period is not shutting down.
  setTimeout(() => {
    try {
      if (detached) process.kill(-child.pid, 'SIGKILL')
      else child.kill('SIGKILL')
    } catch { /* already gone */ }
    process.exit(0)
  }, 3000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => stop(signal))
}

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : code ?? 0)
})
