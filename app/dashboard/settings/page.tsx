'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import type { ProductCostConfig } from '@/lib/costs-config'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}


function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'block' }}>
      <path d="M3 5L7 9L11 5" stroke="#9E9D98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }
const btn: React.CSSProperties = { fontFamily: G, fontSize: '0.75rem', letterSpacing: '0.04em', cursor: 'pointer', padding: '4px 12px', borderRadius: 8, border: '1px solid #E3E2DC', backgroundColor: '#FFFFFF', color: '#6B6A64' }
const inp: React.CSSProperties = { fontFamily: G, fontSize: '0.8125rem', color: '#111110', border: '1px solid #E3E2DC', borderRadius: 8, padding: '5px 10px', width: '100%', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }

// ─── API integrations ─────────────────────────────────────────────────────────

const APIS = [
  { id: 'shopify', name: 'Shopify',   subtitle: 'Ongoing sync · API', connected: true,  envVars: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'] },
  { id: 'meta',    name: 'Meta Ads',  subtitle: 'Ongoing sync · API', connected: true,  envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'] },
  { id: 'weship',  name: 'WeShip',    subtitle: 'Ongoing sync · API', connected: false, envVars: ['WESHIP_API_KEY', 'WESHIP_WAREHOUSE_ID'] },
]

// ─── WeShip invoice months ────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type WeshipMonth = {
  key: string; label: string
  hasServices: boolean; servicesName?: string
}

function buildMonths(): WeshipMonth[] {
  const out: WeshipMonth[] = []
  let y = 2024, m = 11
  while (y < 2026 || (y === 2026 && m <= 4)) {
    const key = `${y}-${String(m).padStart(2,'0')}`
    out.push({ key, label: `${MONTHS_SHORT[m-1]} ${y}`, hasServices: false })
    if (++m > 12) { m = 1; y++ }
  }
  return out.reverse()
}

// ─── COGS data ────────────────────────────────────────────────────────────────

type Item = { id: string; position: string; supplier: string; amount: number }
type Product = { id: string; name: string; subtitle: string; vkBrutto: number; material: Item[] }

const PRODUCTS: Product[] = [
  {
    id: 'bevi-bag', name: 'Bevi Bag Full Set', subtitle: 'Individual product', vkBrutto: 99.90,
    material: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Quanzhou Pengxin Bags', amount: 9.01 },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',       amount: 3.89 },
    ],
  },
  {
    id: 'water-bladder', name: 'Bevi Water Bladder + Tubes', subtitle: 'Individual product', vkBrutto: 19.00,
    material: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Quanzhou Pengxin Bags', amount: 2.53 },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',       amount: 0.40 },
    ],
  },
  {
    id: 'phone-strap', name: 'Bevi Phone Strap', subtitle: 'Individual product', vkBrutto: 14.90,
    material: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Dongguan Webbing',  amount: 0.33 },
      { id: 'm2', position: 'Packaging (EXW)',            supplier: 'Langhai Printing',  amount: 0.11 },
      { id: 'm3', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',   amount: 0.00 },
    ],
  },
  {
    id: 'cleaning-kit', name: 'Bevi Cleaning Kit', subtitle: 'Individual product', vkBrutto: 24.90,
    material: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Licheng Plastic', amount: 1.75 },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda', amount: 1.46 },
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

type BankTxn = { id: string; date: string; counterparty: string; reference: string; amount_eur: number }
type BankUploadResult = { statement_month: string; transactions_parsed: number; transactions_new: number; closing_balance_eur: number | null; date_from: string | null; date_to: string | null }
type PdfUpload = { statement_month: string; date_from: string | null; date_to: string | null; uploaded_at: string }

export default function SettingsPage() {
  const [openApi, setOpenApi]         = useState<string | null>(null)
  const [bankOpen, setBankOpen]       = useState(true)
  const [weshipOpen, setWeshipOpen]   = useState(false)
  const [weshipMonths, setWeshipMonths] = useState<WeshipMonth[]>(buildMonths)
  const [uploading, setUploading]     = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [fileError, setFileError]     = useState<string | null>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const uploadKey  = useRef<string | null>(null)
  const bankFileRef = useRef<HTMLInputElement>(null)
  const [bankUploading, setBankUploading]   = useState(false)
  const [bankUploadResult, setBankUploadResult] = useState<BankUploadResult | null>(null)
  const [bankError, setBankError]           = useState<string | null>(null)
  const [bankTxns, setBankTxns]             = useState<BankTxn[]>([])
  const [pdfUploads, setPdfUploads]         = useState<PdfUpload[]>([])
  const [deletingPdf, setDeletingPdf]       = useState<string | null>(null)
  const [bankDeleteError, setBankDeleteError] = useState<string | null>(null)
  const [bankLoading, setBankLoading]       = useState(true)
  const [selProduct, setSelProduct]         = useState('bevi-bag')
  const [products, setProducts]             = useState<Product[]>(PRODUCTS)
  const [shopifyPrices, setShopifyPrices]   = useState<Record<string, number> | null>(null)
  const [pricesLoading, setPricesLoading]   = useState(true)
  const [payRate, setPayRate]               = useState(2.0)
  const [payFixed, setPayFixed]             = useState(0.25)
  const [saving, setSaving]                 = useState(false)
  const [saveStatus, setSaveStatus]         = useState<'saved' | null>(null)

  async function handleBankPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setBankUploading(true)
    setBankError(null)
    setBankUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch('/api/bank-transactions/upload', { method: 'POST', body: fd })
      const json = await r.json()
      if (!r.ok) { setBankError(json.error ?? 'Upload failed'); return }
      setBankUploadResult(json)
      if (json.statement_month) {
        const entry: PdfUpload = {
          statement_month: json.statement_month,
          date_from:  json.date_from  ?? null,
          date_to:    json.date_to    ?? null,
          uploaded_at: new Date().toISOString(),
        }
        const existing: PdfUpload[] = JSON.parse(localStorage.getItem('bank_pdf_uploads') ?? '[]')
        const idx = existing.findIndex(u => u.statement_month === json.statement_month)
        if (idx >= 0) existing[idx] = entry; else existing.push(entry)
        existing.sort((a, b) => b.statement_month.localeCompare(a.statement_month))
        localStorage.setItem('bank_pdf_uploads', JSON.stringify(existing))
        setPdfUploads(existing)
      }
      const data = await fetch('/api/bank-transactions').then(x => x.json())
      setBankTxns(data.transactions ?? [])
    } catch {
      setBankError('Upload failed — check your connection')
    } finally {
      setBankUploading(false)
      if (bankFileRef.current) bankFileRef.current.value = ''
    }
  }

  async function deletePdf(upload: PdfUpload) {
    setDeletingPdf(upload.statement_month)
    setBankDeleteError(null)
    try {
      const params = new URLSearchParams({ statement_month: upload.statement_month })
      if (upload.date_from) params.set('from', upload.date_from)
      if (upload.date_to)   params.set('to',   upload.date_to)
      const r = await fetch(`/api/bank-transactions?${params}`, { method: 'DELETE' })
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: 'Delete failed' }))
        setBankDeleteError(error ?? 'Delete failed')
        return
      }
      const updated = pdfUploads.filter(u => u.statement_month !== upload.statement_month)
      localStorage.setItem('bank_pdf_uploads', JSON.stringify(updated))
      setPdfUploads(updated)
      const data = await fetch('/api/bank-transactions').then(x => x.json())
      setBankTxns(data.transactions ?? [])
    } catch {
      setBankDeleteError('Delete failed — check your connection')
    } finally {
      setDeletingPdf(null)
    }
  }


  // Load persisted cost amounts from Supabase on mount
  useEffect(() => {
    fetch('/api/costs-config')
      .then(r => r.json())
      .then(({ costs }: { costs: ProductCostConfig[] }) => {
        setProducts(p => p.map(prod => {
          const cfg = costs.find(c => c.id === prod.id)
          if (!cfg) return prod
          return {
            ...prod,
            material: prod.material.map(it => {
              const ci = cfg.items.find(i => i.id === it.id)
              return ci ? { ...it, amount: ci.amount } : it
            }),
          }
        }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/weship-invoice/list')
      .then(r => r.json())
      .then(({ services }: { services?: string[] }) => {
        setWeshipMonths(p => p.map(m => ({
          ...m,
          hasServices:  (services ?? []).includes(m.key),
          servicesName: (services ?? []).includes(m.key) ? `weship-${m.key}-services.xlsx` : undefined,
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/shopify-prices')
      .then(r => r.json())
      .then(({ prices }: { prices: Record<string, number> }) => setShopifyPrices(prices))
      .catch(() => {})
      .finally(() => setPricesLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/bank-transactions')
      .then(r => r.json())
      .then(data => { setBankTxns(data.transactions ?? []) })
      .catch(() => {})
      .finally(() => setBankLoading(false))
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bank_pdf_uploads')
      if (stored) setPdfUploads(JSON.parse(stored))
    } catch {}
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    const k = uploadKey.current
    if (!f || !k) return
    setUploading(k)
    setFileError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('month', k)
      fd.append('type', 'services')
      const r = await fetch('/api/weship-invoice/upload', { method: 'POST', body: fd })
      if (r.ok) {
        setWeshipMonths(p => p.map(m => m.key === k ? { ...m, hasServices: true, servicesName: `weship-${k}-services.xlsx` } : m))
      } else {
        const { error } = await r.json().catch(() => ({ error: 'Upload failed' }))
        setFileError(error ?? 'Upload failed')
      }
    } catch {
      setFileError('Upload failed — check your connection')
    } finally {
      setUploading(null)
      uploadKey.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(monthKey: string) {
    const r = await fetch(`/api/weship-invoice/${monthKey}?type=services`)
    const { url, error } = await r.json()
    if (url) window.open(url, '_blank')
    else setFileError(error ?? 'Download failed')
  }

  async function handleDelete(monthKey: string) {
    setDeleting(monthKey)
    setFileError(null)
    try {
      const r = await fetch(`/api/weship-invoice/${monthKey}?type=services`, { method: 'DELETE' })
      if (r.ok) {
        setWeshipMonths(p => p.map(m => m.key === monthKey ? { ...m, hasServices: false, servicesName: undefined } : m))
      } else {
        const { error } = await r.json().catch(() => ({ error: 'Delete failed' }))
        setFileError(error ?? 'Delete failed')
      }
    } catch {
      setFileError('Delete failed — check your connection')
    } finally {
      setDeleting(null)
    }
  }

  function updateItem(pid: string, iid: string, val: string) {
    setProducts(p => p.map(prod => {
      if (prod.id !== pid) return prod
      return {
        ...prod,
        material: prod.material.map(it => {
          if (it.id !== iid) return it
          const n = parseFloat(val)
          return isNaN(n) ? it : { ...it, amount: n }
        }),
      }
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveStatus(null)
    const overrides: Record<string, Record<string, number>> = {}
    for (const p of products) {
      overrides[p.id] = {}
      for (const it of p.material) {
        overrides[p.id][it.id] = it.amount
      }
    }
    try {
      await fetch('/api/costs-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2500)
    } catch {}
    setSaving(false)
  }

  const prod      = products.find(p => p.id === selProduct)!
  const totalCogs  = prod.material.reduce((s, i) => s + i.amount, 0)
  const vkBrutto   = shopifyPrices?.[selProduct] ?? prod.vkBrutto
  const vkNetto    = vkBrutto / 1.20
  const multiple   = vkNetto / totalCogs

  return (
    <main style={{ padding: '32px 40px' }}>
      <div className="mb-4">
        <h1 style={{ fontFamily: G, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: 0 }}>Settings</h1>
      </div>

      {/* ── 1. AUTOMATED DATA IMPORTS ──────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Automated Data Imports" />
        {APIS.map((api, i) => {
          const open = openApi === api.id
          return (
            <div key={api.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: i === 0 ? 0 : 12, paddingBottom: 12, borderBottom: !open && i < APIS.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>{api.name}</span>
                  <span className="label">{api.subtitle}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, backgroundColor: api.connected ? 'rgba(13,133,133,0.08)' : 'rgba(220,38,38,0.07)', border: `1px solid ${api.connected ? 'rgba(13,133,133,0.2)' : 'rgba(220,38,38,0.18)'}`, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: api.connected ? '#0D8585' : '#DC2626', display: 'inline-block' }} />
                  <span className="label" style={{ color: api.connected ? '#0D8585' : '#DC2626' }}>{api.connected ? 'Connected' : 'Not connected'}</span>
                </div>
                <button style={iconBtn} onClick={() => setOpenApi(open ? null : api.id)}><Chevron open={open} /></button>
              </div>
              {open && (
                <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '12px 16px', marginBottom: i < APIS.length - 1 ? 12 : 0 }}>
                  <span className="label" style={{ display: 'block', marginBottom: 8, color: '#6B6A64' }}>
                    Env variables — configure in <code style={{ fontFamily: 'monospace' }}>.env.local</code>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {api.envVars.map(v => (
                      <span key={v} style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#6B6A64', backgroundColor: '#EDECEA', border: '1px solid #E3E2DC', borderRadius: 4, padding: '2px 7px' }}>{v}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* ── 2. MANUAL DATA ENTRY ───────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Manual Data Entry" />

        {/* Bank Account */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 0, paddingBottom: 12, borderBottom: bankOpen ? 'none' : '1px solid #F0EFE9' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>Bank Account Transactions</span>
              <span className="label">Ongoing · Transaction PDFs from Sparkasse Account</span>
            </div>
            <button style={iconBtn} onClick={() => setBankOpen(!bankOpen)}><Chevron open={bankOpen} /></button>
          </div>

          {bankOpen && (
            <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
              {/* Transaction count */}
              <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #EDECEA' }}>
                <span className="label">
                  {bankLoading ? 'Loading…' : `${bankTxns.length.toLocaleString()} transactions in system`}
                </span>
              </div>

              {/* Error messages */}
              {(bankError || bankDeleteError) && (
                <div style={{ marginBottom: 8, fontFamily: G, fontSize: '0.75rem', color: '#DC2626' }}>
                  {bankError || bankDeleteError}
                </div>
              )}

              {/* PDF list */}
              {pdfUploads.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {pdfUploads.map((upload, i) => {
                    const isLast   = i === pdfUploads.length - 1
                    const fmtMon   = (ds: string | null) =>
                      ds ? new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?'
                    const period   = `${fmtMon(upload.date_from)} – ${fmtMon(upload.date_to)}`
                    const stmtLabel = new Date(upload.statement_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    const isDel    = deletingPdf === upload.statement_month
                    return (
                      <div key={upload.statement_month} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: !isLast ? '1px solid #EDECEA' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#111110' }}>Statement {stmtLabel}</span>
                          <span className="label" style={{ display: 'block', marginTop: 2, color: '#9E9D98' }}>{period}</span>
                        </div>
                        <button
                          style={{ ...btn, color: isDel ? '#9E9D98' : '#DC2626', borderColor: isDel ? '#E3E2DC' : 'rgba(220,38,38,0.2)', cursor: isDel ? 'not-allowed' : 'pointer' }}
                          disabled={isDel}
                          onClick={() => deletePdf(upload)}
                        >
                          {isDel ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {pdfUploads.length === 0 && !bankLoading && bankTxns.length === 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span className="label" style={{ color: '#9E9D98' }}>No transactions yet — upload a Sparkasse PDF to get started.</span>
                </div>
              )}

              {/* Upload button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: pdfUploads.length > 0 ? 10 : 0, borderTop: pdfUploads.length > 0 ? '1px solid #EDECEA' : 'none' }}>
                <button
                  style={{ ...btn, color: bankUploading ? '#9E9D98' : '#6B6A64', cursor: bankUploading ? 'not-allowed' : 'pointer' }}
                  disabled={bankUploading}
                  onClick={() => { setBankError(null); setBankUploadResult(null); setBankDeleteError(null); bankFileRef.current?.click() }}
                >
                  {bankUploading ? 'Parsing…' : '+ Upload PDF'}
                </button>
                {bankUploadResult && (
                  <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#0D8585' }}>
                    {bankUploadResult.transactions_parsed} transactions imported
                  </span>
                )}
              </div>
              <input ref={bankFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleBankPdf} />
            </div>
          )}
        </div>

        {/* WeShip Monthly Invoices */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, paddingBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>WeShip Costs</span>
              <span className="label">Monthly · XLSX service list from WeShip</span>
            </div>
            <button style={iconBtn} onClick={() => setWeshipOpen(!weshipOpen)}><Chevron open={weshipOpen} /></button>
          </div>
          {weshipOpen && (
            <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '4px 16px 8px' }}>
              {fileError && (
                <div style={{ padding: '8px 0 4px', fontSize: '0.75rem', color: '#DC2626', fontFamily: G }}>
                  {fileError}
                </div>
              )}
              {weshipMonths.map((m, i) => {
                const isLast = i === weshipMonths.length - 1
                return (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: !isLast ? '1px solid #EDECEA' : 'none' }}>
                    <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64' }}>{m.label}</span>
                    {m.hasServices ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="label" style={{ color: '#9E9D98' }}>{m.servicesName}</span>
                        <button style={{ ...btn, color: '#0D8585', borderColor: 'rgba(13,133,133,0.2)' }} onClick={() => handleDownload(m.key)}>Download</button>
                        <button
                          style={{ ...btn, color: deleting === m.key ? '#9E9D98' : '#DC2626', borderColor: deleting === m.key ? '#E3E2DC' : 'rgba(220,38,38,0.2)', cursor: deleting === m.key ? 'not-allowed' : 'pointer' }}
                          disabled={deleting === m.key}
                          onClick={() => handleDelete(m.key)}
                        >
                          {deleting === m.key ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <button
                        style={{ ...btn, color: uploading === m.key ? '#9E9D98' : '#6B6A64', cursor: uploading === m.key ? 'not-allowed' : 'pointer' }}
                        disabled={uploading === m.key}
                        onClick={() => { setFileError(null); uploadKey.current = m.key; fileRef.current!.accept = '.xlsx'; fileRef.current?.click() }}
                      >
                        {uploading === m.key ? 'Uploading…' : 'Upload'}
                      </button>
                    )}
                  </div>
                )
              })}
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          )}
        </div>
      </Card>

      {/* ── 3. PRODUCTION & IB SHIPPING COSTS ────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Production & IB Shipping Costs (DDP)" />

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => setSelProduct(p.id)}
              style={{ fontFamily: G, fontSize: '0.75rem', padding: '5px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', transition: 'all 0.1s', borderColor: selProduct === p.id ? '#111110' : '#E3E2DC', backgroundColor: selProduct === p.id ? '#111110' : '#FFFFFF', color: selProduct === p.id ? '#FFFFFF' : '#6B6A64' }}
            >
              {p.name}
              <span style={{ display: 'block', fontSize: '0.625rem', opacity: 0.6, marginTop: 1 }}>{p.subtitle}</span>
            </button>
          ))}
        </div>

        {/* Breakdown table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th className="label" style={{ textAlign: 'left', paddingBottom: 10, paddingRight: 16, borderBottom: '1px solid #E3E2DC', fontWeight: 500, width: 260 }}>Position</th>
                <th className="label" style={{ textAlign: 'left', paddingBottom: 10, paddingRight: 16, borderBottom: '1px solid #E3E2DC', fontWeight: 500 }}>Supplier</th>
                <th className="label" style={{ textAlign: 'right', paddingBottom: 10, borderBottom: '1px solid #E3E2DC', fontWeight: 500, width: 120 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {prod.material.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < prod.material.length - 1 ? '1px solid #F9F8F5' : 'none' }}>
                  <td style={{ padding: '10px 16px 10px 0', fontFamily: G, color: '#111110' }}>{item.position}</td>
                  <td style={{ padding: '10px 16px 10px 0', fontFamily: G, color: '#6B6A64' }}>{item.supplier}</td>
                  <td style={{ padding: '6px 0', width: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input type="number" step="0.01" value={item.amount}
                        onChange={e => updateItem(prod.id, item.id, e.target.value)}
                        style={{ ...inp, width: 76, textAlign: 'right', padding: '4px 6px' }} />
                      <span style={{ color: '#9E9D98', fontSize: '0.6875rem', marginLeft: 6, flexShrink: 0 }}>€</span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #E3E2DC' }}>
                <td colSpan={2} style={{ padding: '10px 16px 10px 0', fontFamily: G, color: '#111110', fontWeight: 700 }}>Total production &amp; IB shipping costs (DDP)</td>
                <td style={{ padding: '10px 0', width: 120 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ width: 76, textAlign: 'right', fontFamily: G, fontWeight: 700, color: '#111110', fontSize: '0.8125rem', padding: '4px 6px', display: 'inline-block' }}>
                      {totalCogs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: '#9E9D98', fontSize: '0.6875rem', marginLeft: 6, flexShrink: 0 }}>€</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Save button */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {saveStatus === 'saved' && (
            <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#0D8585' }}>Saved</span>
          )}
          <button
            style={{ ...btn, backgroundColor: saving ? '#F5F4F0' : '#111110', color: saving ? '#9E9D98' : '#FFFFFF', border: 'none', padding: '8px 40px', cursor: saving ? 'not-allowed' : 'pointer' }}
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E3E2DC', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: '#E3E2DC', borderRadius: 12, overflow: 'hidden' }}>
          {/* Selling Price (gross) — live from Shopify */}
          <div style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 6 }}>Selling Price (gross)</span>
            <span style={{ fontFamily: G, fontSize: '0.9375rem', fontWeight: 600, color: '#111110' }}>
              {pricesLoading ? '—' : fmt(vkBrutto)}
            </span>
          </div>
          {/* Selling Price (net) */}
          <div style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 6 }}>Selling Price (net)</span>
            <span style={{ fontFamily: G, fontSize: '0.9375rem', fontWeight: 600, color: '#111110' }}>
              {pricesLoading ? '—' : fmt(vkNetto)}
            </span>
          </div>
          {/* Production COGS */}
          <div style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 6 }}>Prod. &amp; IB Shipping Costs (DDP)</span>
            <span style={{ fontFamily: G, fontSize: '0.9375rem', fontWeight: 600, color: '#6B6A64' }}>{fmt(totalCogs)}</span>
          </div>
          {/* Cost multiple */}
          <div style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 6 }}>Cost Multiple</span>
            <span style={{ fontFamily: G, fontSize: '0.9375rem', fontWeight: 600, color: '#6B6A64' }}>
              {pricesLoading ? '—' : `${multiple.toFixed(2)}×`}
            </span>
          </div>
        </div>
      </Card>

      {/* ── 4. PAYMENT & SHOPIFY FEE ──────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Payment & Shopify Fee" />
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64' }}>
            Fee per order is calculated as: <strong style={{ color: '#111110' }}>variable rate (%) × gross + fixed fee per order</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Variable Rate (%)</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" step="0.1" min="0"
                value={payRate}
                onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setPayRate(n) }}
                style={{ ...inp, width: 80, textAlign: 'right', padding: '5px 8px' }}
              />
              <span style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>%</span>
            </div>
          </div>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Fixed Fee per Order</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" step="0.01" min="0"
                value={payFixed}
                onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setPayFixed(n) }}
                style={{ ...inp, width: 80, textAlign: 'right', padding: '5px 8px' }}
              />
              <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>€</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, padding: '8px 14px', backgroundColor: '#F5F4F0', borderRadius: 10, display: 'inline-flex', alignItems: 'center' }}>
          <span className="label" style={{ color: '#6B6A64', whiteSpace: 'nowrap' }}>
            Example: order with 49.90 € gross → {(() => {
              const ex = 49.90
              const total = Math.round((payRate / 100 * ex + payFixed) * 100) / 100
              return `${(payRate).toFixed(1)}% × ${ex.toFixed(2)} € + ${payFixed.toFixed(2)} € = ${total.toFixed(2)} €`
            })()}
          </span>
        </div>
      </Card>

    </main>
  )
}
