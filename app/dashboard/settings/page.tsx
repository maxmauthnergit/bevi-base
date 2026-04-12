'use client'

import { useState, useRef } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(v: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', display: 'block' }}
    >
      <path d="M3 5L7 9L11 5" stroke="#9E9D98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
      <path d="M6 8V2M6 2L4 4M6 2L8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
      <path d="M6 4v6M6 10L4 8M6 10L8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// ─── Static data ─────────────────────────────────────────────────────────────

const API_INTEGRATIONS = [
  {
    id: 'shopify',
    name: 'Shopify',
    subtitle: 'Ongoing sync · API',
    connected: false,
    envVars: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    subtitle: 'Ongoing sync · API',
    connected: false,
    envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
  },
  {
    id: 'weship',
    name: 'WeShip',
    subtitle: 'Ongoing sync · API',
    connected: false,
    envVars: ['WESHIP_API_KEY', 'WESHIP_WAREHOUSE_ID'],
  },
]

const INITIAL_BANK_HISTORY = [
  { date: '2026-04-01', amount: 12450 },
  { date: '2026-03-03', amount: 18200 },
  { date: '2026-02-02', amount: 9820 },
  { date: '2026-01-06', amount: 14300 },
  { date: '2025-12-02', amount: 11750 },
]

function buildWeshipMonths() {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const uploaded = new Set([
    '2024-11','2024-12',
    '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
    '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
    '2026-01','2026-02','2026-03',
  ])
  const rows: { key: string; label: string; hasFile: boolean; fileName?: string }[] = []
  let y = 2024, m = 11
  while (y < 2026 || (y === 2026 && m <= 4)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    rows.push({
      key,
      label: `${names[m - 1]} ${y}`,
      hasFile: uploaded.has(key),
      fileName: uploaded.has(key) ? `weship-invoice-${key}.pdf` : undefined,
    })
    m++; if (m > 12) { m = 1; y++ }
  }
  return rows.reverse()
}

const INITIAL_WESHIP_MONTHS = buildWeshipMonths()

type CogsRow = {
  id: string; product: string; variant: string; sku: string
  purchasePrice: number; weshipFee: number; sellingPrice: number
}

const INITIAL_COGS: CogsRow[] = [
  { id: 'bb-black', product: 'Bevi Bag',      variant: 'Black', sku: '9180013220099', purchasePrice: 42.00, weshipFee: 8.50, sellingPrice: 129.00 },
  { id: 'bb-beige', product: 'Bevi Bag',      variant: 'Beige', sku: '9180013220129', purchasePrice: 42.00, weshipFee: 8.50, sellingPrice: 129.00 },
  { id: 'ck',       product: 'Cleaning Kit',  variant: '—',     sku: 'CK-001',        purchasePrice: 7.20,  weshipFee: 4.50, sellingPrice: 24.90  },
  { id: 'ps',       product: 'Phone Strap',   variant: '—',     sku: 'PS-001',        purchasePrice: 5.80,  weshipFee: 3.80, sellingPrice: 19.90  },
  { id: 'wb',       product: 'Water Bladder', variant: '—',     sku: 'WB-001',        purchasePrice: 11.50, weshipFee: 4.50, sellingPrice: 34.90  },
]

// ─── Shared style helpers ────────────────────────────────────────────────────

const gustavoFont = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const btnBase: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 8,
  border: '1px solid #E3E2DC',
  backgroundColor: '#FFFFFF',
  fontFamily: gustavoFont,
  fontSize: '0.75rem',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  color: '#6B6A64',
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const inputStyle: React.CSSProperties = {
  fontFamily: gustavoFont,
  fontSize: '0.8125rem',
  color: '#111110',
  border: '1px solid #E3E2DC',
  borderRadius: 8,
  padding: '5px 8px',
  width: '100%',
  backgroundColor: '#FFFFFF',
  outline: 'none',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Accordion
  const [openApi, setOpenApi]     = useState<string | null>(null)
  const [bankOpen, setBankOpen]   = useState(false)
  const [weshipOpen, setWeshipOpen] = useState(false)

  // Bank balance dialog
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [dialogDate, setDialogDate]     = useState('')
  const [dialogAmount, setDialogAmount] = useState('')
  const [bankHistory, setBankHistory]   = useState(INITIAL_BANK_HISTORY)

  // WeShip invoices
  const [weshipMonths, setWeshipMonths] = useState(INITIAL_WESHIP_MONTHS)
  const fileInputRef     = useRef<HTMLInputElement>(null)
  const uploadTargetRef  = useRef<string | null>(null)

  // COGS
  const [cogs, setCogs] = useState(INITIAL_COGS)

  function handleBankSave() {
    if (!dialogDate || !dialogAmount) return
    setBankHistory(prev => [{ date: dialogDate, amount: parseFloat(dialogAmount) }, ...prev])
    setDialogDate(''); setDialogAmount(''); setDialogOpen(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && uploadTargetRef.current) {
      const key = uploadTargetRef.current
      setWeshipMonths(prev => prev.map(m =>
        m.key === key ? { ...m, hasFile: true, fileName: file.name } : m
      ))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateCogs(id: string, field: keyof CogsRow, raw: string) {
    const value = parseFloat(raw)
    if (isNaN(value)) return
    setCogs(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1280 }}>

      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: gustavoFont, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: 0 }}>
          Settings
        </h1>
      </div>

      {/* ── 1. AUTOMATED DATA IMPORTS ─────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Automated Data Imports" />

        {API_INTEGRATIONS.map((integration, i) => {
          const isOpen = openApi === integration.id
          const isLast = i === API_INTEGRATIONS.length - 1
          return (
            <div key={integration.id}>
              {/* Row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  paddingTop: 12, paddingBottom: 12,
                  borderBottom: !isOpen && !isLast ? '1px solid #F0EFE9' : 'none',
                }}
              >
                {/* Name + subtitle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: gustavoFont, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>
                    {integration.name}
                  </span>
                  <span className="label">{integration.subtitle}</span>
                </div>

                {/* Last sync */}
                <span className="label" style={{ whiteSpace: 'nowrap', color: '#9E9D98' }}>Last sync: —</span>

                {/* Status badge */}
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 6,
                    backgroundColor: 'rgba(220,38,38,0.07)',
                    border: '1px solid rgba(220,38,38,0.18)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block' }} />
                  <span className="label" style={{ color: '#DC2626' }}>Not connected</span>
                </div>

                {/* Sync now */}
                <button disabled style={{ ...btnBase, color: '#9E9D98', cursor: 'not-allowed' }}>
                  Sync now
                </button>

                {/* Chevron */}
                <button
                  style={iconBtn}
                  onClick={() => setOpenApi(isOpen ? null : integration.id)}
                  aria-label="Toggle credentials"
                >
                  <ChevronDown open={isOpen} />
                </button>
              </div>

              {/* Accordion: credentials */}
              {isOpen && (
                <div
                  style={{
                    backgroundColor: '#F5F4F0', borderRadius: 12, padding: '14px 16px',
                    marginBottom: isLast ? 0 : 12,
                    borderBottom: !isLast ? '1px solid #F0EFE9' : 'none',
                  }}
                >
                  <span className="label" style={{ display: 'block', marginBottom: 8, color: '#6B6A64' }}>
                    Env variables — configure in{' '}
                    <code style={{ fontFamily: 'monospace', color: '#6B6A64' }}>.env.local</code>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {integration.envVars.map(v => (
                      <span
                        key={v}
                        className="metric"
                        style={{
                          fontSize: '0.6875rem', color: '#6B6A64',
                          backgroundColor: '#EDECEA', border: '1px solid #E3E2DC',
                          borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace',
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* ── 2. MANUAL DATA ENTRY ──────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Manual Data Entry" />

        {/* Bank Account Balance */}
        <div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              paddingTop: 12, paddingBottom: 12,
              borderBottom: bankOpen ? 'none' : '1px solid #F0EFE9',
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: gustavoFont, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>
                Bank Account Balance
              </span>
              <span className="label">Ad hoc · Sparkasse business account</span>
            </div>
            <button style={btnBase} onClick={() => setDialogOpen(true)}>
              Enter value
            </button>
            <button style={iconBtn} onClick={() => setBankOpen(!bankOpen)} aria-label="Toggle history">
              <ChevronDown open={bankOpen} />
            </button>
          </div>

          {bankOpen && (
            <div
              style={{
                backgroundColor: '#F5F4F0', borderRadius: 12, padding: '4px 16px 8px',
                marginBottom: 12,
                borderBottom: '1px solid #F0EFE9',
              }}
            >
              {bankHistory.length === 0 && (
                <span className="label" style={{ display: 'block', padding: '12px 0', color: '#9E9D98' }}>No entries yet.</span>
              )}
              {bankHistory.map((entry, i) => (
                <div
                  key={`${entry.date}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: i < bankHistory.length - 1 ? '1px solid #EDECEA' : 'none',
                  }}
                >
                  <span className="label" style={{ color: '#6B6A64' }}>{formatDate(entry.date)}</span>
                  <span
                    className="metric"
                    style={{ fontFamily: gustavoFont, fontSize: '0.875rem', color: '#111110', fontWeight: 600 }}
                  >
                    {formatEur(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WeShip Monthly Invoice */}
        <div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              paddingTop: 12, paddingBottom: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: gustavoFont, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>
                WeShip Monthly Invoice
              </span>
              <span className="label">Monthly · Upload PDF invoice from WeShip EU/AT</span>
            </div>
            <button style={iconBtn} onClick={() => setWeshipOpen(!weshipOpen)} aria-label="Toggle invoices">
              <ChevronDown open={weshipOpen} />
            </button>
          </div>

          {weshipOpen && (
            <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '4px 16px 8px', marginBottom: 4 }}>
              {weshipMonths.map((m, i) => (
                <div
                  key={m.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: i < weshipMonths.length - 1 ? '1px solid #EDECEA' : 'none',
                  }}
                >
                  <span style={{ fontFamily: gustavoFont, fontSize: '0.8125rem', color: '#6B6A64' }}>
                    {m.label}
                  </span>
                  {m.hasFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="label" style={{ color: '#9E9D98' }}>{m.fileName}</span>
                      <button
                        style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 5, color: '#0D8585', borderColor: 'rgba(13,133,133,0.2)' }}
                      >
                        <DownloadIcon />
                        Download
                      </button>
                    </div>
                  ) : (
                    <button
                      style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => {
                        uploadTargetRef.current = m.key
                        fileInputRef.current?.click()
                      }}
                    >
                      <UploadIcon />
                      Upload
                    </button>
                  )}
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── 3. PRODUCT COSTS & COGS ───────────────────────────────────────── */}
      <Card>
        <CardHeader
          label="Product Costs & COGS"
          action={
            <span className="label" style={{ color: '#9E9D98' }}>Edit values inline · auto-calculates margin</span>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {[
                  { label: 'Product',         align: 'left'  },
                  { label: 'Variant',         align: 'left'  },
                  { label: 'SKU',             align: 'left'  },
                  { label: 'Purchase Price',  align: 'right' },
                  { label: 'WeShip Fee',      align: 'right' },
                  { label: 'COGS Total',      align: 'right' },
                  { label: 'Selling Price',   align: 'right' },
                  { label: 'Gross Margin',    align: 'right' },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    className="label"
                    style={{
                      textAlign: align as 'left' | 'right',
                      paddingBottom: 10, paddingRight: 16,
                      borderBottom: '1px solid #E3E2DC',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cogs.map((row, i) => {
                const cogsTotal = row.purchasePrice + row.weshipFee
                const margin    = ((row.sellingPrice - cogsTotal) / row.sellingPrice) * 100
                return (
                  <tr
                    key={row.id}
                    style={{ borderBottom: i < cogs.length - 1 ? '1px solid #F0EFE9' : 'none' }}
                  >
                    {/* Product */}
                    <td style={{ padding: '10px 16px 10px 0' }}>
                      <span style={{ fontFamily: gustavoFont, color: '#111110' }}>{row.product}</span>
                    </td>

                    {/* Variant */}
                    <td style={{ padding: '10px 16px 10px 0', color: '#6B6A64', fontFamily: gustavoFont }}>
                      {row.variant}
                    </td>

                    {/* SKU */}
                    <td style={{ padding: '10px 16px 10px 0' }}>
                      <span className="metric" style={{ fontSize: '0.6875rem', color: '#9E9D98' }}>{row.sku}</span>
                    </td>

                    {/* Purchase Price */}
                    <td style={{ padding: '10px 16px 10px 0', textAlign: 'right' }}>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 8, color: '#9E9D98', fontSize: '0.75rem', pointerEvents: 'none' }}>€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={row.purchasePrice}
                          onChange={e => updateCogs(row.id, 'purchasePrice', e.target.value)}
                          style={{ ...inputStyle, width: 72, textAlign: 'right', paddingLeft: 18 }}
                        />
                      </div>
                    </td>

                    {/* WeShip Fee */}
                    <td style={{ padding: '10px 16px 10px 0', textAlign: 'right' }}>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 8, color: '#9E9D98', fontSize: '0.75rem', pointerEvents: 'none' }}>€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={row.weshipFee}
                          onChange={e => updateCogs(row.id, 'weshipFee', e.target.value)}
                          style={{ ...inputStyle, width: 72, textAlign: 'right', paddingLeft: 18 }}
                        />
                      </div>
                    </td>

                    {/* COGS Total (calculated) */}
                    <td style={{ padding: '10px 16px 10px 0', textAlign: 'right' }}>
                      <span className="metric" style={{ fontFamily: gustavoFont, color: '#111110', fontWeight: 600 }}>
                        {formatEur(cogsTotal)}
                      </span>
                    </td>

                    {/* Selling Price */}
                    <td style={{ padding: '10px 16px 10px 0', textAlign: 'right' }}>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 8, color: '#9E9D98', fontSize: '0.75rem', pointerEvents: 'none' }}>€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={row.sellingPrice}
                          onChange={e => updateCogs(row.id, 'sellingPrice', e.target.value)}
                          style={{ ...inputStyle, width: 72, textAlign: 'right', paddingLeft: 18 }}
                        />
                      </div>
                    </td>

                    {/* Gross Margin */}
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>
                      <span
                        className="metric"
                        style={{
                          fontFamily: gustavoFont,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: margin >= 50 ? '#0D8585' : '#DC2626',
                        }}
                      >
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* COGS footnote */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F0EFE9' }}>
          <span className="label" style={{ color: '#9E9D98' }}>
            Purchase Price = ex-works unit cost · WeShip Fee = avg. per-unit fulfillment cost · COGS = sum of both
          </span>
        </div>
      </Card>

      {/* ── Bank Balance Dialog ───────────────────────────────────────────── */}
      {dialogOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(17,17,16,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setDialogOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 16,
              padding: 28, width: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: gustavoFont, fontSize: '1rem', fontWeight: 600, color: '#111110', margin: '0 0 20px' }}>
              Enter Bank Balance
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={dialogDate}
                onChange={e => setDialogDate(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Amount (EUR)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9E9D98', fontSize: '0.8125rem', pointerEvents: 'none' }}>€</span>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={dialogAmount}
                  onChange={e => setDialogAmount(e.target.value)}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', paddingLeft: 24 }}
                  onKeyDown={e => e.key === 'Enter' && handleBankSave()}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={btnBase} onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...btnBase,
                  backgroundColor: '#111110',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '5px 16px',
                }}
                onClick={handleBankSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
