import { NextResponse, type NextRequest } from 'next/server'

// Optimistic auth gate. Per the Next.js docs, Proxy runs on every matched
// request — including prefetches — so it only reads the session cookie and
// never talks to Supabase. Verifying the session here cost a network
// round-trip per request and timed out the invocation (504
// MIDDLEWARE_INVOCATION_TIMEOUT) whenever Supabase was slow to answer.
//
// The authoritative check lives in app/dashboard/layout.tsx, which calls
// supabase.auth.getUser() and redirects when there is no user. A forged
// cookie gets past this gate and is rejected there.

// @supabase/ssr names its cookies sb-<project-ref>-auth-token and splits
// oversized ones into .0 / .1 chunks.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

export function proxy(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => AUTH_COOKIE.test(cookie.name) && cookie.value !== '')

  const { pathname } = request.nextUrl

  if (!hasSession && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
