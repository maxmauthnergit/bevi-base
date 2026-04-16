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
  statement_month: string        // "2026-03"
  closing_balance_eur: number | null
  transactions: BankTransaction[]
}

const MONTHS_DE: Record<string, number> = {
  Januar: 1, Februar: 2, März: 3, April: 4,
  Mai: 5, Juni: 6, Juli: 7, August: 8,
  September: 9, Oktober: 10, November: 11, Dezember: 12,
}

const MONTH_PAT = Object.keys(MONTHS_DE).join('|')

// Handles "€ 1.234,56", "− € 1.234,56", "- € 1.234,56", "+ € 1.234,56"
function parseGermanAmount(s: string): number {
  const sign   = /[−\-]/.test(s.split('€')[0]) ? -1 : 1
  const digits = s.replace(/[^0-9,]/g, '').replace(/\./g, '').replace(',', '.')
  return sign * parseFloat(digits)
}

function makeId(date: string, counterparty: string, reference: string, amount: number): string {
  const key = `${date}|${counterparty.trim()}|${reference.trim()}|${amount.toFixed(2)}`
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

// Skip non-transaction lines that start with a German date pattern
const SKIP_KEYWORDS = /Saldo|Kontostand|Kontoeingänge|Kontoausgänge|Abschlussbuchung/i

export function parseSparkasseText(rawText: string): ParsedStatement {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ── Year + month from header ──────────────────────────────────────────────
  const headerRe  = new RegExp(`(${MONTH_PAT})\\s+(\\d{4})`)
  const headerMatch = text.match(headerRe)
  const year  = headerMatch ? parseInt(headerMatch[2]) : new Date().getFullYear()
  const month = headerMatch ? MONTHS_DE[headerMatch[1]] : null
  const statement_month = month ? `${year}-${String(month).padStart(2, '0')}` : ''

  // ── Closing balance: "Neuer Saldo", "Schlusssaldo", "Kontostand …" ────────
  const balRe = /(?:Neuer Saldo|Schlusssaldo|Kontostand[^\n]*?)\s*\+?\s*€?\s*([\d.]+,\d{2})/i
  const balMatch = text.match(balRe)
  const closing_balance_eur = balMatch
    ? parseFloat(balMatch[1].replace(/\./g, '').replace(',', '.'))
    : null

  // ── Transaction parsing ───────────────────────────────────────────────────
  // Strategy: find every occurrence of "DD. Monat" that precedes an amount,
  // treat the text between date and amount as description.
  const AMOUNT_STR = `[−\\-\\+]?\\s*€\\s*[\\d.]+,\\d{2}`
  const DATE_RE    = new RegExp(`(\\d{1,2})\\.\\s+(${MONTH_PAT})\\b`, 'g')

  // Collect all (position, isoDate) date tokens in text
  type DateToken = { index: number; end: number; iso: string }
  const dateTokens: DateToken[] = []
  let dm: RegExpExecArray | null
  while ((dm = DATE_RE.exec(text)) !== null) {
    const dayN  = parseInt(dm[1])
    const monN  = MONTHS_DE[dm[2]]
    if (!monN || dayN < 1 || dayN > 31) continue
    const iso = `${year}-${String(monN).padStart(2, '0')}-${String(dayN).padStart(2, '0')}`
    dateTokens.push({ index: dm.index, end: dm.index + dm[0].length, iso })
  }

  const AMOUNT_RE_G = new RegExp(AMOUNT_STR, 'g')
  const transactions: BankTransaction[] = []

  for (let i = 0; i < dateTokens.length; i++) {
    const segStart = dateTokens[i].end
    const segEnd   = dateTokens[i + 1]?.index ?? text.length
    const segment  = text.slice(segStart, segEnd).trim()

    // Skip balance-summary "transactions"
    if (SKIP_KEYWORDS.test(segment)) continue

    // Find all amounts in segment; the transaction amount is the last one
    AMOUNT_RE_G.lastIndex = 0
    const amtMatches: RegExpExecArray[] = []
    let am: RegExpExecArray | null
    while ((am = AMOUNT_RE_G.exec(segment)) !== null) amtMatches.push(am)
    if (!amtMatches.length) continue

    const lastAmt    = amtMatches[amtMatches.length - 1]
    const amount_eur = parseGermanAmount(lastAmt[0])
    if (isNaN(amount_eur)) continue

    // Description = everything before the last amount, cleaned up
    const desc       = segment.slice(0, lastAmt.index).replace(/\s+/g, ' ').trim()
    const descLines  = desc.split(/\n|  {2,}/).map(l => l.trim()).filter(Boolean)
    const counterparty = descLines[0] ?? ''
    const reference    = descLines.slice(1).join(' ')

    const raw = text.slice(dateTokens[i].index, segEnd).trim()
    const id  = makeId(dateTokens[i].iso, counterparty, reference, amount_eur)

    transactions.push({ id, date: dateTokens[i].iso, counterparty, reference, amount_eur, raw })
  }

  return { statement_month, closing_balance_eur, transactions }
}
