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
  statement_month: string        // "2026-03" (most recent month found)
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
  // Handles "€ 1.234,56", "− € 1.234,56", "+ € 1.234,56"
  const isNeg = /[−\-]/.test(s.split('€')[0])
  const digits = s.replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.')
  return isNeg ? -parseFloat(digits) : parseFloat(digits)
}

function makeId(date: string, counterparty: string, reference: string, amount: number): string {
  const key = `${date}|${counterparty.trim()}|${reference.trim()}|${amount.toFixed(2)}`
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

const SKIP_RE = /^(Saldo|Kontostand|Kontoeingänge|Kontoausgänge|Abschlussbuchung|um\s+\d{3,4})/i

export function parseSparkasseText(rawText: string): ParsedStatement {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ── Build a position→year map from every "Monat YYYY" header ─────────────
  // e.g. "März 2026", "Oktober 2024" scattered across the multi-year PDF
  const headerRe  = new RegExp(`(${MONTH_PAT})\\s+(\\d{4})`, 'g')
  type YearAt = { index: number; year: number; month: number }
  const yearMarkers: YearAt[] = []
  let hm: RegExpExecArray | null
  while ((hm = headerRe.exec(text)) !== null) {
    yearMarkers.push({ index: hm.index, year: parseInt(hm[2]), month: MONTHS_DE[hm[1]] })
  }
  // Sort ascending
  yearMarkers.sort((a, b) => a.index - b.index)

  function yearAtPos(pos: number): number {
    // Most recent year marker before this position
    let best = yearMarkers[0]?.year ?? new Date().getFullYear()
    for (const m of yearMarkers) {
      if (m.index <= pos) best = m.year
      else break
    }
    return best
  }

  // Most recent statement month (last marker)
  const lastMarker     = yearMarkers[yearMarkers.length - 1]
  const statement_month = lastMarker
    ? `${lastMarker.year}-${String(lastMarker.month).padStart(2, '0')}`
    : ''

  // ── Closing balance ───────────────────────────────────────────────────────
  const balRe    = /(?:Neuer Saldo|Schlusssaldo|Kontostand[^\n]*?)\s*\+?\s*€?\s*([\d.]+,\d{2})/i
  const balMatch = text.match(balRe)
  const closing_balance_eur = balMatch
    ? parseFloat(balMatch[1].replace(/\./g, '').replace(',', '.'))
    : null

  // ── Transaction parsing ───────────────────────────────────────────────────
  // Amount format: "€ 1.234,56" or "− € 1.234,56" (€ BEFORE digits)
  // We intentionally ignore "+amount €" (push-notification section)
  const AMOUNT_RE_SRC = `[−\\-]?\\s*€\\s*[\\d.]+,\\d{2}`
  const DATE_RE       = new RegExp(`(\\d{1,2})\\.\\s+(${MONTH_PAT})\\b`, 'g')

  type DateToken = { index: number; end: number; iso: string }
  const dateTokens: DateToken[] = []
  let dm: RegExpExecArray | null
  while ((dm = DATE_RE.exec(text)) !== null) {
    const dayN = parseInt(dm[1])
    const monN = MONTHS_DE[dm[2]]
    if (!monN || dayN < 1 || dayN > 31) continue
    const yr  = yearAtPos(dm.index)
    const iso = `${yr}-${String(monN).padStart(2, '0')}-${String(dayN).padStart(2, '0')}`
    dateTokens.push({ index: dm.index, end: dm.index + dm[0].length, iso })
  }

  const AMOUNT_RE_G = new RegExp(AMOUNT_RE_SRC, 'g')
  const transactions: BankTransaction[] = []

  for (let i = 0; i < dateTokens.length; i++) {
    const segStart = dateTokens[i].end
    const segEnd   = dateTokens[i + 1]?.index ?? text.length
    const segment  = text.slice(segStart, segEnd).trim()

    // Skip push-notification entries: text after date starts with "um HHmm" or "um H:mm"
    if (SKIP_RE.test(segment)) continue

    // Find all "€-before-amount" occurrences in this segment
    AMOUNT_RE_G.lastIndex = 0
    const amtMatches: RegExpExecArray[] = []
    let am: RegExpExecArray | null
    while ((am = AMOUNT_RE_G.exec(segment)) !== null) amtMatches.push(am)
    if (!amtMatches.length) continue

    // Transaction amount = last match in segment
    const lastAmt    = amtMatches[amtMatches.length - 1]
    const amount_eur = parseGermanAmount(lastAmt[0])
    if (isNaN(amount_eur)) continue

    // Everything before the last amount = description
    const desc      = segment.slice(0, lastAmt.index).replace(/\s+/g, ' ').trim()
    const descLines = desc.split(/\n|  {2,}/).map(l => l.trim()).filter(Boolean)

    // If description contains further "DD. Monat" patterns the segment spans
    // multiple real transactions — take only the text before the first internal date
    const internalDate = new RegExp(`\\d{1,2}\\.\\s+(?:${MONTH_PAT})\\b`)
    const firstInternal = descLines.findIndex(l => internalDate.test(l))
    const cleanLines = firstInternal > 0 ? descLines.slice(0, firstInternal) : descLines

    const counterparty = cleanLines[0] ?? ''
    const reference    = cleanLines.slice(1).join(' ')

    // Skip if counterparty looks like a time ("um 1501") — notification row
    if (/^um\s+\d{3,4}$/.test(counterparty.trim())) continue

    const raw = text.slice(dateTokens[i].index, segEnd).trim()
    const id  = makeId(dateTokens[i].iso, counterparty, reference, amount_eur)

    transactions.push({ id, date: dateTokens[i].iso, counterparty, reference, amount_eur, raw })
  }

  return { statement_month, closing_balance_eur, transactions }
}
