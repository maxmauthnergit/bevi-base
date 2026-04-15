'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
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
  { id: 'shopify', name: 'Shopify',   subtitle: 'Ongoing sync · API', connected: true,  lastSync: 'Today, 14:23', envVars: ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'] },
  { id: 'meta',    name: 'Meta Ads',  subtitle: 'Ongoing sync · API', connected: true,  lastSync: 'Today, 14:23', envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'] },
  { id: 'weship',  name: 'WeShip',    subtitle: 'Ongoing sync · API', connected: false, lastSync: null,           envVars: ['WESHIP_API_KEY', 'WESHIP_WAREHOUSE_ID'] },
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

type Item = { id: string; label: string; amount: number }
type Product = { id: string; name: string; subtitle: string; vkBrutto: number; material: Item[] }

const PRODUCTS: Product[] = [
  {
    id: 'bevi-bag', name: 'Bevi Bag Full Set', subtitle: 'Individual product', vkBrutto: 99.90,
    material: [
      { id: 'm1', label: 'Production costs (EXW) | Quanzhou Pengxin Bags', amount: 9.01 },
      { id: 'm2', label: 'Shipping & Customs to Graz | Shenzhen Amanda',   amount: 3.89 },
    ],
  },
  {
    id: 'water-bladder', name: 'Bevi Water Bladder + Tubes', subtitle: 'Individual product', vkBrutto: 19.00,
    material: [
      { id: 'm1', label: 'Production costs (EXW) | Quanzhou Pengxin Bags', amount: 2.53 },
      { id: 'm2', label: 'Shipping & Customs to Graz | Shenzhen Amanda',   amount: 0.40 },
    ],
  },
  {
    id: 'phone-strap', name: 'Bevi Phone Strap', subtitle: 'Individual product', vkBrutto: 14.90,
    material: [
      { id: 'm1', label: 'Production costs (EXW) | Dongguan Webbing', amount: 0.33 },
      { id: 'm2', label: 'Packaging (EXW) | Langhai Printing',        amount: 0.11 },
    ],
  },
  {
    id: 'cleaning-kit', name: 'Bevi Cleaning Kit', subtitle: 'Individual product', vkBrutto: 24.90,
    material: [
      { id: 'm1', label: 'Production costs (EXW) | Licheng Plastic',      amount: 1.75 },
      { id: 'm2', label: 'Shipping & Customs to Graz | Shenzhen Amanda',  amount: 1.46 },
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [openApi, setOpenApi]         = useState<string | null>(null)
  const [bankOpen, setBankOpen]       = useState(false)
  const [weshipOpen, setWeshipOpen]   = useState(false)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [dialogDate, setDialogDate]   = useState('')
  const [dialogAmt, setDialogAmt]     = useState('')
  const [bankHistory, setBankHistory] = useState([
    { date: '2026-04-01', amount: 12450 },
    { date: '2026-03-03', amount: 18200 },
    { date: '2026-02-02', amount: 9820 },
    { date: '2026-01-06', amount: 14300 },
    { date: '2025-12-02', amount: 11750 },
  ])
  const [weshipMonths, setWeshipMonths] = useState<WeshipMonth[]>(buildMonths)
  const [uploading, setUploading]     = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [fileError, setFileError]     = useState<string | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const uploadKey = useRef<string | null>(null)
  const [selProduct, setSelProduct]   = useState('bevi-bag')
  const [products, setProducts]       = useState<Product[]>(PRODUCTS)
  const [shopifyPrices, setShopifyPrices] = useState<Record<string, number> | null>(null)
  const [pricesLoading, setPricesLoading] = useState(true)
  const [payRate, setPayRate]         = useState(2.0)
  const [payFixed, setPayFixed]       = useState(0.25)

  function saveBankEntry() {
    if (!dialogDate || !dialogAmt) return
    setBankHistory(p => [{ date: dialogDate, amount: parseFloat(dialogAmt) }, ...p])
    setDialogDate(''); setDialogAmt(''); setDialogOpen(false)
  }

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
    const n = parseFloat(val)
    if (isNaN(n)) return
    setProducts(p => p.map(prod => {
      if (prod.id !== pid) return prod
      return { ...prod, material: prod.material.map(it => it.id === iid ? { ...it, amount: n } : it) }
    }))
  }

  const prod      = products.find(p => p.id === selProduct)!
  const totalCogs  = prod.material.reduce((s, i) => s + i.amount, 0)
  const vkBrutto   = shopifyPrices?.[selProduct] ?? prod.vkBrutto
  const vkNetto    = vkBrutto / 1.20
  const multiple   = vkNetto / totalCogs

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1280 }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: G, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: 0 }}>Settings</h1>
      </div>

      {/* ── 1. AUTOMATED DATA IMPORTS ──────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Automated Data Imports" />
        {APIS.map((api, i) => {
          const open = openApi === api.id
          return (
            <div key={api.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, paddingBottom: 12, borderBottom: !open && i < APIS.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>{api.name}</span>
                  <span className="label">{api.subtitle}</span>
                </div>
                <span className="label" style={{ color: '#9E9D98', whiteSpace: 'nowrap' }}>
                  {api.lastSync ? `Last sync: ${api.lastSync}` : 'Last sync: —'}
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, backgroundColor: api.connected ? 'rgba(13,133,133,0.08)' : 'rgba(220,38,38,0.07)', border: `1px solid ${api.connected ? 'rgba(13,133,133,0.2)' : 'rgba(220,38,38,0.18)'}`, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: api.connected ? '#0D8585' : '#DC2626', display: 'inline-block' }} />
                  <span className="label" style={{ color: api.connected ? '#0D8585' : '#DC2626' }}>{api.connected ? 'Connected' : 'Not connected'}</span>
                </div>
                <button style={{ ...btn, color: api.connected ? '#6B6A64' : '#9E9D98', cursor: api.connected ? 'pointer' : 'not-allowed' }} disabled={!api.connected}>Sync now</button>
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

        {/* Bank Balance */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, paddingBottom: 12, borderBottom: bankOpen ? 'none' : '1px solid #F0EFE9' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>Bank Account Balance</span>
              <span className="label">Ad hoc · Sparkasse business account</span>
            </div>
            <button style={btn} onClick={() => setDialogOpen(true)}>Enter value</button>
            <button style={iconBtn} onClick={() => setBankOpen(!bankOpen)}><Chevron open={bankOpen} /></button>
          </div>
          {bankOpen && (
            <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '4px 16px 8px', marginBottom: 12 }}>
              {bankHistory.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < bankHistory.length - 1 ? '1px solid #EDECEA' : 'none' }}>
                  <span className="label" style={{ color: '#6B6A64' }}>{fmtDate(e.date)}</span>
                  <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', fontWeight: 600 }}>{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WeShip Monthly Invoices */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, paddingBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>WeShip Monthly Files</span>
              <span className="label">Monthly · XLSX service list from WeShip EU/AT</span>
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
      <Card>
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
                {['Position', 'Amount', '% of Total'].map((h, i) => (
                  <th key={h} className="label" style={{ textAlign: i === 0 ? 'left' : 'right', paddingBottom: 10, borderBottom: '1px solid #E3E2DC', paddingRight: i < 2 ? 16 : 0, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prod.material.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < prod.material.length - 1 ? '1px solid #F9F8F5' : 'none' }}>
                  <td style={{ padding: '8px 16px 8px 12px', color: '#6B6A64', fontFamily: G }}>{item.label}</td>
                  <td style={{ padding: '8px 16px 8px 0', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>€</span>
                      <input type="number" step="0.01" value={item.amount} onChange={e => updateItem(prod.id, item.id, e.target.value)}
                        style={{ ...inp, width: 68, textAlign: 'right', padding: '3px 6px' }} />
                    </div>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#9E9D98', fontSize: '0.75rem' }}>{((item.amount / totalCogs) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #E3E2DC' }}>
                <td style={{ padding: '10px 16px 10px 12px', fontFamily: G, color: '#111110', fontWeight: 700 }}>Total Production &amp; IB Shipping Costs (DDP)</td>
                <td style={{ padding: '10px 16px 10px 0', textAlign: 'right', fontFamily: G, fontWeight: 700, color: '#111110' }}>{fmt(totalCogs)}</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#6B6A64', fontSize: '0.75rem' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E3E2DC', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: '#E3E2DC', borderRadius: 12, overflow: 'hidden' }}>
          {/* Selling Price (gross) — live from Shopify */}
          <div style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
            <div style={{ marginBottom: 6 }}>
              <span className="label">Selling Price (gross)</span>
            </div>
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
            <span className="label" style={{ display: 'block', marginBottom: 6 }}>Production COGS</span>
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
      <Card className="mt-4 mb-4">
        <CardHeader label="Payment & Shopify Fee" />
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64' }}>
            Fee per order is calculated as: <strong style={{ color: '#111110' }}>rate% × gross + fixed fee</strong>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 480 }}>
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>€</span>
              <input
                type="number" step="0.01" min="0"
                value={payFixed}
                onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setPayFixed(n) }}
                style={{ ...inp, width: 80, textAlign: 'right', padding: '5px 8px' }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#F5F4F0', borderRadius: 10, maxWidth: 480 }}>
          <span className="label" style={{ color: '#6B6A64' }}>
            Example: order with €49.90 gross → {(() => {
              const ex = 49.90
              const total = Math.round((payRate / 100 * ex + payFixed) * 100) / 100
              return `${(payRate).toFixed(1)}% × €${ex.toFixed(2)} + €${payFixed.toFixed(2)} = €${total.toFixed(2)}`
            })()}
          </span>
        </div>
      </Card>

      {/* ── Bank Balance Dialog ─────────────────────────────────────────────── */}
      {dialogOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17,17,16,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setDialogOpen(false)}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: G, fontSize: '1rem', fontWeight: 600, color: '#111110', margin: '0 0 20px' }}>Enter Bank Balance</h3>
            <div style={{ marginBottom: 14 }}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Date</label>
              <input type="date" value={dialogDate} onChange={e => setDialogDate(e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Amount (EUR)</label>
              <input type="number" step="1" placeholder="0" value={dialogAmt} onChange={e => setDialogAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBankEntry()} style={inp} autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={btn} onClick={() => setDialogOpen(false)}>Cancel</button>
              <button style={{ ...btn, backgroundColor: '#111110', color: '#FFFFFF', border: 'none', padding: '5px 16px' }} onClick={saveBankEntry}>Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
