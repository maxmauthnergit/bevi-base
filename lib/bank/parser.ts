import { createHash } from 'crypto'

export interface BankTransaction {
  id: string
  date: string        // ISO "2026-03-31"
  counterparty: string
  reference: string
  amount_eur: number  // negative = debit
  raw: string
}

export interface ParsedStatement {
  statement_month: string
  closing_balance_eur: number | null
  transactions: BankTransaction[]
}

const MONTHS_DE: Record<string, number> = {
  Januar: 1, Februar: 2, März: 3, April: 4,
  Mai: 5, Juni: 6, Juli: 7, August: 8,
  September: 9, Oktober: 10, November: 11, Dezember: 12,
}
const MONTH_PAT = Object.keys(MONTHS_DE).join('|')

function parseGermanAmount(s: string): number {
  const isNeg = /[−\-]/.test(s.split('€')[0])
  const digits = s.replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.')
  return isNeg ? -parseFloat(digits) : parseFloat(digits)
}

function makeId(date: string, counterparty: string, amount: number): string {
  const key = `${date}|${counterparty.trim()}|${amount.toFixed(2)}`
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

export function parseSparkasseText(rawText: string): ParsedStatement {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ── Build position→year map from every "Monat YYYY" header ───────────────
  type YearAt = { index: number; year: number; month: number }
  const yearMarkers: YearAt[] = []
  const headerRe = new RegExp(`(${MONTH_PAT})\\s+(\\d{4})`, 'g')
  let hm: RegExpExecArray | null
  while ((hm = headerRe.exec(text)) !== null)
    yearMarkers.push({ index: hm.index, year: parseInt(hm[2]), month: MONTHS_DE[hm[1]] })
  yearMarkers.sort((a, b) => a.index - b.index)

  function yearAtPos(pos: number): number {
    let best = yearMarkers[0]?.year ?? new Date().getFullYear()
    for (const m of yearMarkers) { if (m.index <= pos) best = m.year; else break }
    return best
  }

  const lastMarker = yearMarkers[yearMarkers.length - 1]
  const statement_month = lastMarker
    ? `${lastMarker.year}-${String(lastMarker.month).padStart(2, '0')}`
    : ''

  // ── Closing balance ───────────────────────────────────────────────────────
  const balMatch = text.match(
    /(?:Neuer Saldo|Schlusssaldo|Kontostand[^\n]*?)\s*\+?\s*€?\s*([\d.]+,\d{2})/i,
  )
  const closing_balance_eur = balMatch
    ? parseFloat(balMatch[1].replace(/\./g, '').replace(',', '.'))
    : null

  // ── Amount-first transaction parsing ─────────────────────────────────────
  // Strategy: find every "€ amount" (€ BEFORE digits) — these are statement
  // transactions. Notification-section amounts use "+amount €" format (€ AFTER)
  // so they are automatically excluded.
  //
  // For each amount, the "slot" is the text from the previous amount's end to
  // this amount's start. The LAST "DD. Monat" date in the slot is this
  // transaction's date. Everything between that date and the amount = description.

  const AMOUNT_RE = /[−\-]?\s*€\s*[\d.]+,\d{2}/g
  const DATE_RE   = new RegExp(`(\\d{1,2})\\.\\s+(${MONTH_PAT})\\b`, 'g')

  type AmtToken = { index: number; end: number; raw: string }
  const amounts: AmtToken[] = []
  let am: RegExpExecArray | null
  while ((am = AMOUNT_RE.exec(text)) !== null)
    amounts.push({ index: am.index, end: am.index + am[0].length, raw: am[0] })

  const transactions: BankTransaction[] = []

  for (let i = 0; i < amounts.length; i++) {
    const slotStart = i > 0 ? amounts[i - 1].end : 0
    const slotEnd   = amounts[i].index
    const slot      = text.slice(slotStart, slotEnd)

    // Find the LAST date token in this slot
    DATE_RE.lastIndex = 0
    const dateMatches: RegExpExecArray[] = []
    let dm: RegExpExecArray | null
    while ((dm = DATE_RE.exec(slot)) !== null) dateMatches.push(dm)
    if (!dateMatches.length) continue

    const lastDate = dateMatches[dateMatches.length - 1]
    const dayN = parseInt(lastDate[1])
    const monN = MONTHS_DE[lastDate[2]]
    if (!monN || dayN < 1 || dayN > 31) continue

    const yr      = yearAtPos(slotStart + lastDate.index!)
    const isoDate = `${yr}-${String(monN).padStart(2, '0')}-${String(dayN).padStart(2, '0')}`

    // Description = everything after the last date token, up to the amount
    const descRaw = slot.slice(lastDate.index! + lastDate[0].length).trim()

    // Skip notification entries: immediately start with a time pattern
    // (handles regular colons, non-breaking spaces, Unicode × etc.)
    if (/^um\b/i.test(descRaw)) continue
    // Skip Abschlussbuchung and other internal bookings
    if (/^\*/.test(descRaw)) continue
    // Skip balance / summary lines
    if (/^(Saldo|Kontostand|Kontoeingänge|Kontoausgänge)/i.test(descRaw)) continue
    // Skip empty
    if (!descRaw.replace(/\s/g, '')) continue

    const amount_eur = parseGermanAmount(amounts[i].raw)
    if (isNaN(amount_eur)) continue

    // Clean up description — collapse whitespace, remove non-printable chars
    const desc   = descRaw.replace(/[^\x20-\x7E\u00C0-\u024F\u00A0]/g, ' ').replace(/\s+/g, ' ').trim()
    // Heuristic split: Sparkasse references often start with an all-caps word
    // or a digit pattern (e.g. "Shopify ABC123", "1049.../PAYPAL", "AR/2026/...")
    const refMatch = desc.match(/\s+([A-Z0-9]{6,}[/\-]?\S*|(?:AR|Shopify|PAYPAL)\S*)/)
    const counterparty = refMatch ? desc.slice(0, refMatch.index).trim() : desc
    const reference    = refMatch ? refMatch[0].trim() : ''

    const raw = `${lastDate[0]}${descRaw} ${amounts[i].raw}`
    const id  = makeId(isoDate, counterparty || desc, amount_eur)

    transactions.push({ id, date: isoDate, counterparty, reference, amount_eur, raw })
  }

  return { statement_month, closing_balance_eur, transactions }
}
