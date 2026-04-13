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

const UPLOADED = new Set(['2024-11','2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03'])
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function buildMonths() {
  const out: { key: string; label: string; hasFile: boolean; fileName?: string }[] = []
  let y = 2024, m = 11
  while (y < 2026 || (y === 2026 && m <= 4)) {
    const key = `${y}-${String(m).padStart(2,'0')}`
    out.push({ key, label: `${MONTHS_SHORT[m-1]} ${y}`, hasFile: UPLOADED.has(key), fileName: UPLOADED.has(key) ? `weship-invoice-${key}.pdf` : undefined })
    if (++m > 12) { m = 1; y++ }
  }
  return out.reverse()
}

// ─── COGS data ────────────────────────────────────────────────────────────────

type Item = { id: string; label: string; amount: number }
type Product = { id: string; name: string; subtitle: string; vkBrutto: number; material: Item[]; fulfillment: Item[] }

const PRODUCTS: Product[] = [
  {
    id: 'bevi-bag', name: 'Bevi Bag Full Set', subtitle: 'Individual product', vkBrutto: 99.90,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: Bevi Bag Full Set', amount: 9.01 },
      { id: 'm2', label: 'Shenzen Amanda: Shipping + Zoll Bevi Bag', amount: 3.89 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.30 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,35–1,40 €)', amount: 1.14 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 2.25 },
    ],
  },
  {
    id: 'bundle-s', name: 'Bundle S', subtitle: 'Bevi Bag + Phone Strap', vkBrutto: 104.90,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: Bevi Bag Full Set', amount: 9.01 },
      { id: 'm2', label: 'Shenzen Amanda: Shipping + Zoll Bevi Bag', amount: 3.89 },
      { id: 'm3', label: 'Dongguan Webbing: Patch + Lanyard', amount: 0.33 },
      { id: 'm4', label: 'Langhai Printing: Envelope', amount: 0.11 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.60 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,35–1,40 €)', amount: 1.30 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 2.35 },
    ],
  },
  {
    id: 'bundle-m', name: 'Bundle M', subtitle: 'Bevi Bag + Cleaning Kit', vkBrutto: 109.90,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: Bevi Bag Full Set', amount: 9.01 },
      { id: 'm2', label: 'Shenzen Amanda: Shipping + Zoll Bevi Bag', amount: 3.89 },
      { id: 'm3', label: 'Licheng Plastic: Cleaning Kit', amount: 1.75 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.60 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,35–1,40 €)', amount: 1.30 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 2.45 },
    ],
  },
  {
    id: 'bundle-l', name: 'Bundle L', subtitle: 'Bevi Bag + Phone Strap + Cleaning Kit', vkBrutto: 119.90,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: Bevi Bag Full Set', amount: 9.01 },
      { id: 'm2', label: 'Shenzen Amanda: Shipping + Zoll Bevi Bag', amount: 3.89 },
      { id: 'm3', label: 'Licheng Plastic: Cleaning Kit', amount: 1.75 },
      { id: 'm4', label: 'Shenzen Amanda: Shipping + Zoll Cleaning Kit', amount: 1.46 },
      { id: 'm5', label: 'Dongguan Webbing: Patch + Lanyard', amount: 0.33 },
      { id: 'm6', label: 'Langhai Printing: Envelope', amount: 0.11 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.90 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,35–1,40 €)', amount: 1.39 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 2.65 },
    ],
  },
  {
    id: 'water-bladder', name: 'Bevi Water Bladder + Tubes', subtitle: 'Individual product', vkBrutto: 19.00,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: Water Bladder + Tubes', amount: 2.53 },
      { id: 'm2', label: 'Shenzen Amanda: Water Bladder + Tubes (Schätzung)', amount: 0.40 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.30 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,15–1,40 €)', amount: 1.15 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE (Schätzung)', amount: 2.50 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 0.63 },
    ],
  },
  {
    id: 'phone-strap', name: 'Bevi Phone Strap', subtitle: 'Individual product', vkBrutto: 14.90,
    material: [
      { id: 'm1', label: 'Dongguan Webbing: Patch + Lanyard', amount: 0.33 },
      { id: 'm2', label: 'Langhai Printing: Envelope', amount: 0.11 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.30 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,15–1,40 €)', amount: 1.15 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.14 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 2.50 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 0.55 },
    ],
  },
  {
    id: 'cleaning-kit', name: 'Bevi Cleaning Kit', subtitle: 'Individual product', vkBrutto: 24.90,
    material: [
      { id: 'm1', label: 'Licheng Plastic: Cleaning Kit', amount: 1.75 },
      { id: 'm2', label: 'Shenzen Amanda: Shipping + Zoll Cleaning Kit', amount: 1.46 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.30 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,15–1,40 €)', amount: 1.15 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 0.75 },
    ],
  },
  {
    id: 'squad', name: 'Squad Bundle', subtitle: '3× Bevi Bag', vkBrutto: 199.00,
    material: [
      { id: 'm1', label: 'Quanzhou Pengxin Bags: 3× Bevi Bag Full Set', amount: 27.03 },
      { id: 'm2', label: 'Shenzen Amanda: 3× Shipping + Zoll Bevi Bag', amount: 11.67 },
    ],
    fulfillment: [
      { id: 'f1', label: 'WeShip: Auftragsabwicklung pro Paket', amount: 0.56 },
      { id: 'f2', label: 'WeShip: Kommissionierung (ca. 0,30 €/SKU)', amount: 0.90 },
      { id: 'f3', label: 'WeShip: Verpackung und Versand (1,35–1,40 €)', amount: 1.70 },
      { id: 'f4', label: 'WeShip: Paketbeilager', amount: 0.25 },
      { id: 'f5', label: 'WeShip: Verpackungsmaterial (Karton + Füllmaterial)', amount: 0.64 },
      { id: 'f6', label: 'WeShip: Warenannahme (2,90 €/Anlieferungskarton)', amount: 0.15 },
      { id: 'f7', label: 'Post/DHL: Versandkosten nach DE', amount: 5.40 },
      { id: 'f8', label: 'Shopify: Payment Fee (2% + 0,25 € je Bestellung)', amount: 4.23 },
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
  const [weshipMonths, setWeshipMonths] = useState(buildMonths)
  const [uploading, setUploading]     = useState<string | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const uploadKey = useRef<string | null>(null)
  const [selProduct, setSelProduct]   = useState('bevi-bag')
  const [products, setProducts]       = useState<Product[]>(PRODUCTS)

  function saveBankEntry() {
    if (!dialogDate || !dialogAmt) return
    setBankHistory(p => [{ date: dialogDate, amount: parseFloat(dialogAmt) }, ...p])
    setDialogDate(''); setDialogAmt(''); setDialogOpen(false)
  }

  useEffect(() => {
    fetch('/api/weship-invoice/list')
      .then(r => r.json())
      .then(({ months }: { months: string[] }) => {
        if (!Array.isArray(months)) return
        setWeshipMonths(p => p.map(m => ({
          ...m,
          hasFile: months.includes(m.key),
          fileName: months.includes(m.key) ? `weship-invoice-${m.key}.pdf` : undefined,
        })))
      })
      .catch(() => {})
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    const k = uploadKey.current
    if (!f || !k) return
    setUploading(k)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('month', k)
      const r = await fetch('/api/weship-invoice/upload', { method: 'POST', body: fd })
      if (r.ok) {
        setWeshipMonths(p => p.map(m => m.key === k ? { ...m, hasFile: true, fileName: f.name } : m))
      }
    } finally {
      setUploading(null)
      uploadKey.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(monthKey: string) {
    try {
      const r = await fetch(`/api/weship-invoice/${monthKey}`)
      const { url } = await r.json()
      if (url) window.open(url, '_blank')
    } catch {}
  }

  function updateItem(pid: string, section: 'material' | 'fulfillment', iid: string, val: string) {
    const n = parseFloat(val)
    if (isNaN(n)) return
    setProducts(p => p.map(prod => {
      if (prod.id !== pid) return prod
      return { ...prod, [section]: prod[section].map(it => it.id === iid ? { ...it, amount: n } : it) }
    }))
  }

  const prod = products.find(p => p.id === selProduct)!
  const totalMat  = prod.material.reduce((s, i) => s + i.amount, 0)
  const totalFul  = prod.fulfillment.reduce((s, i) => s + i.amount, 0)
  const totalCogs = totalMat + totalFul
  const vkNetto   = prod.vkBrutto / 1.20
  const db        = vkNetto - totalCogs
  const margin    = (db / vkNetto) * 100
  const multiple  = (vkNetto / totalCogs) * 100

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
              <span style={{ fontFamily: G, fontSize: '0.875rem', color: '#111110', display: 'block', marginBottom: 2 }}>WeShip Monthly Invoices</span>
              <span className="label">Monthly · PDF invoice from WeShip EU/AT</span>
            </div>
            <button style={iconBtn} onClick={() => setWeshipOpen(!weshipOpen)}><Chevron open={weshipOpen} /></button>
          </div>
          {weshipOpen && (
            <div style={{ backgroundColor: '#F5F4F0', borderRadius: 12, padding: '4px 16px 8px' }}>
              {weshipMonths.map((m, i) => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < weshipMonths.length - 1 ? '1px solid #EDECEA' : 'none' }}>
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64' }}>{m.label}</span>
                  {m.hasFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="label" style={{ color: '#9E9D98' }}>{m.fileName}</span>
                      <button
                        style={{ ...btn, color: '#0D8585', borderColor: 'rgba(13,133,133,0.2)' }}
                        onClick={() => handleDownload(m.key)}
                      >
                        Download
                      </button>
                    </div>
                  ) : (
                    <button
                      style={{ ...btn, color: uploading === m.key ? '#9E9D98' : '#6B6A64', cursor: uploading === m.key ? 'not-allowed' : 'pointer' }}
                      disabled={uploading === m.key}
                      onClick={() => { uploadKey.current = m.key; fileRef.current?.click() }}
                    >
                      {uploading === m.key ? 'Uploading…' : 'Upload'}
                    </button>
                  )}
                </div>
              ))}
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          )}
        </div>
      </Card>

      {/* ── 3. PRODUCT COSTS & COGS ────────────────────────────────────────── */}
      <Card>
        <CardHeader label="Product Costs & COGS" action={<span className="label" style={{ color: '#9E9D98' }}>Edit values inline · 20% MwSt.</span>} />

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
                {['Position', 'Betrag', '% of COGS'].map((h, i) => (
                  <th key={h} className="label" style={{ textAlign: i === 0 ? 'left' : 'right', paddingBottom: 10, borderBottom: '1px solid #E3E2DC', paddingRight: i < 2 ? 16 : 0, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Material section */}
              <tr>
                <td colSpan={3} style={{ padding: '10px 0 4px', paddingTop: 14 }}>
                  <span className="label" style={{ color: '#9E9D98', letterSpacing: '0.08em' }}>MATERIAL + PRODUKT SOURCING</span>
                </td>
              </tr>
              {prod.material.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < prod.material.length - 1 ? '1px solid #F9F8F5' : 'none' }}>
                  <td style={{ padding: '7px 16px 7px 12px', color: '#6B6A64', fontFamily: G }}>{item.label}</td>
                  <td style={{ padding: '7px 16px 7px 0', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>€</span>
                      <input type="number" step="0.01" value={item.amount} onChange={e => updateItem(prod.id, 'material', item.id, e.target.value)}
                        style={{ ...inp, width: 68, textAlign: 'right', padding: '3px 6px' }} />
                    </div>
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: '#9E9D98', fontSize: '0.75rem' }}>{((item.amount / totalCogs) * 100).toFixed(2)}%</td>
                </tr>
              ))}
              {/* Material subtotal */}
              <tr style={{ borderTop: '1px solid #E3E2DC', borderBottom: '1px solid #E3E2DC' }}>
                <td style={{ padding: '8px 16px 8px 12px', fontFamily: G, color: '#111110', fontWeight: 600 }}>Gesamt Material + Shipping ins Lager</td>
                <td style={{ padding: '8px 16px 8px 0', textAlign: 'right', fontFamily: G, fontWeight: 600, color: '#111110' }}>{fmt(totalMat)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#6B6A64', fontSize: '0.75rem' }}>{((totalMat / totalCogs) * 100).toFixed(2)}%</td>
              </tr>

              {/* Fulfillment section */}
              <tr>
                <td colSpan={3} style={{ padding: '14px 0 4px' }}>
                  <span className="label" style={{ color: '#9E9D98', letterSpacing: '0.08em' }}>ZAHLUNGSABWICKLUNG + SHIPPING</span>
                </td>
              </tr>
              {prod.fulfillment.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < prod.fulfillment.length - 1 ? '1px solid #F9F8F5' : 'none' }}>
                  <td style={{ padding: '7px 16px 7px 12px', color: '#6B6A64', fontFamily: G }}>{item.label}</td>
                  <td style={{ padding: '7px 16px 7px 0', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>€</span>
                      <input type="number" step="0.01" value={item.amount} onChange={e => updateItem(prod.id, 'fulfillment', item.id, e.target.value)}
                        style={{ ...inp, width: 68, textAlign: 'right', padding: '3px 6px' }} />
                    </div>
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', color: '#9E9D98', fontSize: '0.75rem' }}>{((item.amount / totalCogs) * 100).toFixed(2)}%</td>
                </tr>
              ))}

              {/* COGS total */}
              <tr style={{ borderTop: '1px solid #E3E2DC' }}>
                <td style={{ padding: '10px 16px 10px 12px', fontFamily: G, color: '#111110', fontWeight: 700 }}>Gesamt Kosten Bestellung beim Kunden</td>
                <td style={{ padding: '10px 16px 10px 0', textAlign: 'right', fontFamily: G, fontWeight: 700, color: '#111110' }}>{fmt(totalCogs)}</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#6B6A64', fontSize: '0.75rem' }}>100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E3E2DC', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', backgroundColor: '#E3E2DC', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'VK Preis Netto',     value: fmt(vkNetto),          color: '#111110' },
            { label: 'VK Preis Brutto',    value: fmt(prod.vkBrutto),    color: '#111110' },
            { label: 'DB Netto',           value: fmt(db),               color: '#0D8585' },
            { label: 'Netto Gewinnmarge',  value: `${margin.toFixed(2)}%`, color: margin >= 60 ? '#0D8585' : '#DC2626' },
            { label: 'Multiple auf Kosten', value: `${multiple.toFixed(2)}%`, color: '#6B6A64' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#F5F4F0', padding: '14px 16px' }}>
              <span className="label" style={{ display: 'block', marginBottom: 6 }}>{s.label}</span>
              <span style={{ fontFamily: G, fontSize: '0.9375rem', fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
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
