import { createHash } from 'crypto'

export interface BankTransaction {
  id: string
  date: string        // ISO "2026-03-31"
  counterparty: string
  reference: string
  amount_eur: number  // positive = credit, negative = debit (if sign available)
  raw: string
}

export interface ParsedStatement {
  statement_month: string
  closing_balance_eur: number | null
  transactions: BankTransaction[]
}

// Full and abbreviated month names (Austrian + Standard German)
const MONTHS: Record<string, number> = {
  Januar: 1, Jänner: 1, 'Jan.': 1, 'Jän.': 1,
  Februar: 2, 'Feb.': 2,
  März: 3, 'Mär.': 3,
  April: 4, 'Apr.': 4,
  Mai: 5,
  Juni: 6, 'Jun.': 6,
  Juli: 7, 'Jul.': 7,
  August: 8, 'Aug.': 8,
  September: 9, 'Sep.': 9,
  Oktober: 10, 'Okt.': 10,
  November: 11, 'Nov.': 11,
  Dezember: 12, 'Dez.': 12,
}

// Build regex pattern — longer names first to avoid prefix matches
const MONTH_PAT = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .map(m => m.replace('.', '\\.'))
  .join('|')

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

  // ── Year/month markers ("März 2026", "Jänner 2025", …) ───────────────────
  type YearAt = { index: number; year: number; month: number }
  const yearMarkers: YearAt[] = []
  const headerRe = new RegExp(`(${MONTH_PAT})\\s+(\\d{4})`, 'g')
  let hm: RegExpExecArray | null
  while ((hm = headerRe.exec(text)) !== null)
    yearMarkers.push({ index: hm.index, year: parseInt(hm[2]), month: MONTHS[hm[1]] })
  yearMarkers.sort((a, b) => a.index - b.index)

  // statement_month = FIRST marker in text (= most recent month, PDF goes newest→oldest)
  const firstMarker = yearMarkers[0]
  const statement_month = firstMarker
    ? `${firstMarker.year}-${String(firstMarker.month).padStart(2, '0')}`
    : ''

  function yearAtPos(pos: number): number {
    let best = yearMarkers[0]?.year ?? new Date().getFullYear()
    for (const m of yearMarkers) { if (m.index <= pos) best = m.year; else break }
    return best
  }

  // ── Closing balance ───────────────────────────────────────────────────────
  const balMatch = text.match(
    /(?:Neuer Saldo|Schlusssaldo|Kontostand[^\n]*?)\s*\+?\s*€?\s*([\d.]+,\d{2})/i,
  )
  const closing_balance_eur = balMatch
    ? parseFloat(balMatch[1].replace(/\./g, '').replace(',', '.'))
    : null

  // ── Amount-first parsing ──────────────────────────────────────────────────
  // Each statement transaction ends with "€amount" (€ BEFORE digits).
  // Notification-section amounts use "+amount€" (€ AFTER) → excluded automatically.
  //
  // For each €amount, the "slot" = text from previous amount's end to this one.
  // The LAST "DD. Monat" date in the slot is this transaction's date.
  // Text after that date = description (counterparty + reference).

  // NO \b at end — dates run directly into counterparty ("31. MärzStripe…")
  const DATE_RE   = new RegExp(`(\\d{1,2})\\.\\s+(${MONTH_PAT})`, 'g')
  const AMOUNT_RE = /[−\-]?\s*€\s*[\d.]+,\d{2}/g

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

    // Find the LAST date in this slot
    DATE_RE.lastIndex = 0
    const dateMatches: RegExpExecArray[] = []
    let dm: RegExpExecArray | null
    while ((dm = DATE_RE.exec(slot)) !== null) dateMatches.push(dm)
    if (!dateMatches.length) continue

    const lastDate = dateMatches[dateMatches.length - 1]
    const dayN = parseInt(lastDate[1])
    const monN = MONTHS[lastDate[2]]
    if (!monN || dayN < 1 || dayN > 31) continue

    const yr      = yearAtPos(slotStart + lastDate.index!)
    const isoDate = `${yr}-${String(monN).padStart(2, '0')}-${String(dayN).padStart(2, '0')}`

    // Description = text after last date token up to the amount
    const descRaw = slot.slice(lastDate.index! + lastDate[0].length).trim()

    // Skip notification entries ("um 15:01" or "um 1501" after date)
    if (/^um\b/i.test(descRaw)) continue
    // Skip Abschlussbuchung
    if (/^\*/.test(descRaw)) continue
    // Skip balance/summary lines
    if (/^(Saldo|Kontostand|Kontoeingänge|Kontoausgänge)/i.test(descRaw)) continue
    if (!descRaw.replace(/\s/g, '')) continue

    const amount_eur = parseGermanAmount(amounts[i].raw)
    if (isNaN(amount_eur)) continue

    // Clean non-printable chars, collapse whitespace
    const desc = descRaw.replace(/[^\x20-\x7E\u00C0-\u024F\u00A0-\u00FF]/g, ' ').replace(/\s+/g, ' ').trim()

    // Split counterparty / reference
    // Sparkasse references: Shopify codes, /PAYPAL suffixes, AR/YYYY/… invoice refs
    const refMatch = desc.match(/\s+((?:Shopify|AR\/|PAYPAL)[^\s]*)|(\/PAYPAL\S*)|(\b[A-Z0-9]{6,}\b)/)
    const counterparty = refMatch ? desc.slice(0, refMatch.index).trim() : desc
    const reference    = refMatch ? desc.slice(refMatch.index!).trim() : ''

    const raw = `${isoDate} ${desc} ${amounts[i].raw}`
    const id  = makeId(isoDate, counterparty || desc, amount_eur)

    transactions.push({ id, date: isoDate, counterparty, reference, amount_eur, raw })
  }

  return { statement_month, closing_balance_eur, transactions }
}
