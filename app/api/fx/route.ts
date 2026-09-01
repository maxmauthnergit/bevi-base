import { NextRequest, NextResponse } from 'next/server'

// ECB reference rates via Frankfurter — free, no key, no rate limit worth
// worrying about. Fetched server-side so the browser never hits a third party.
const BASE = 'https://api.frankfurter.dev/v1'

// Rates barely change once published, so a day's rate can be cached hard.
export const revalidate = 3600

/**
 * GET /api/fx?date=YYYY-MM-DD → { rate, date, requested }
 *
 * `rate` is USD→EUR. `date` is the day the rate actually comes from, which can
 * be earlier than `requested`: the ECB only publishes on business days, so a
 * weekend or holiday resolves to the previous publication. The caller shows
 * that date, otherwise you would book a rate whose day you never saw.
 */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 422 })
  }

  // Frankfurter has no data for future dates; asking for one returns the latest
  // available, which would be silently wrong. Reject it instead.
  const today = new Date().toISOString().slice(0, 10)
  if (requested > today) {
    return NextResponse.json({ error: 'No rate exists for a future date' }, { status: 422 })
  }

  try {
    const res = await fetch(`${BASE}/${requested}?base=USD&symbols=EUR`, {
      next: { revalidate },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Rate service returned ${res.status}` }, { status: 502 })
    }

    const json = await res.json() as { date?: string; rates?: Record<string, number> }
    const rate = json.rates?.EUR

    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: 'Rate service returned no USD/EUR rate' }, { status: 502 })
    }

    return NextResponse.json({ rate, date: json.date ?? requested, requested })
  } catch (e) {
    // The form stays usable on a manually typed rate, so this is a soft failure.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not reach the rate service' },
      { status: 502 },
    )
  }
}
