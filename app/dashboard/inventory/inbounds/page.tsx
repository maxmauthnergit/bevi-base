'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { DatePicker, DateReadout } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Modal'
import { G, inp, btn, btnPrimary, btnDanger, iconBtn, fmtEur, fmtInt } from '@/components/ui/formStyles'
import {
  INBOUND_PRODUCTS, SHIP_MODES, shipModeLabel, inboundTotals, arrivalSpan,
  reconcileQuantities, productName, usdToEur,
  type Inbound, type InboundItem, type InboundShipment, type InboundInvoice,
  type Partner, type ShipMode, type DateSpan,
} from '@/lib/inbounds'
import { fmtDate, todayIso } from '@/lib/inbound-calc'

// ─── Draft ───────────────────────────────────────────────────────────────────
// Numbers are held as strings so a cleared field stays cleared instead of
// snapping back to 0 while typing. Amounts are USD — that is how the suppliers
// invoice; EUR is derived from the rate of the day that part was paid.

interface DraftItem {
  product_id: string
  quantity:   string
  costUsd:    string
  supplierId: string
}

interface DraftShipment {
  id:         string | null    // null until saved; invoices can only target saved ones
  mode:       ShipMode
  companyId:  string
  costUsd:    string
  fx:         string
  fxDate:     string
  planned:    string
  actual:     string
  qty:        Record<string, string>   // product_id -> quantity on this leg
}

interface Draft {
  id:           string | null
  charge:       string
  orderDate:    string
  productionFx: string
  productionFxDate: string
  notes:        string
  items:        DraftItem[]
  shipments:    DraftShipment[]
}

function blankDraft(): Draft {
  const today = todayIso()
  return {
    id: null, charge: '', orderDate: today,
    productionFx: '', productionFxDate: today,
    notes: '', items: [], shipments: [],
  }
}

function draftFrom(inb: Inbound): Draft {
  return {
    id:        inb.id,
    charge:    inb.charge,
    orderDate: inb.order_date,
    productionFx:     inb.production_fx_usd_eur != null ? String(inb.production_fx_usd_eur) : '',
    productionFxDate: inb.production_fx_date ?? inb.order_date,
    notes:     inb.notes,
    items: inb.items.map(it => ({
      product_id: it.product_id,
      quantity:   String(it.quantity),
      costUsd:    String(it.production_cost_usd),
      supplierId: it.supplier_id ?? '',
    })),
    shipments: inb.shipments.map(sh => ({
      id:        sh.id ?? null,
      mode:      sh.mode,
      companyId: sh.shipping_company_id ?? '',
      costUsd:   String(sh.cost_usd),
      fx:        sh.fx_usd_eur != null ? String(sh.fx_usd_eur) : '',
      fxDate:    sh.fx_date ?? inb.order_date,
      planned:   sh.planned_arrival ?? '',
      actual:    sh.actual_arrival ?? '',
      qty: Object.fromEntries(sh.items.map(si => [si.product_id, String(si.quantity)])),
    })),
  }
}

const num = (v: string) => Number(v) || 0
const fxOf = (v: string) => {
  const n = Number(v)
  return v.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n
}

const toItems = (d: Draft): InboundItem[] => {
  const fx = fxOf(d.productionFx)
  return d.items.filter(it => it.product_id).map(it => ({
    product_id:          it.product_id,
    quantity:            num(it.quantity),
    production_cost_usd: num(it.costUsd),
    production_cost_eur: usdToEur(num(it.costUsd), fx) ?? 0,
    supplier_id:         it.supplierId || null,
  }))
}

const toShipments = (d: Draft): InboundShipment[] => d.shipments.map(sh => {
  const fx = fxOf(sh.fx)
  return {
    id:                  sh.id ?? undefined,
    mode:                sh.mode,
    shipping_company_id: sh.companyId || null,
    cost_usd:            num(sh.costUsd),
    cost_eur:            usdToEur(num(sh.costUsd), fx) ?? 0,
    fx_usd_eur:          fx,
    fx_date:             sh.fxDate || null,
    planned_arrival:     sh.planned || null,
    actual_arrival:      sh.actual || null,
    items: Object.entries(sh.qty)
      .map(([product_id, q]) => ({ product_id, quantity: num(q) }))
      .filter(si => si.quantity > 0),
  }
})

// ─── Presentation helpers ────────────────────────────────────────────────────

function spanText(span: DateSpan | null): string {
  if (!span) return '—'
  return span.min === span.max ? fmtDate(span.min) : `${fmtDate(span.min)} – ${fmtDate(span.max)}`
}

const eurOrDash = (usd: number, fx: number | null) => {
  const eur = usdToEur(usd, fx)
  return eur === null ? '—' : fmtEur(eur)
}

// Every cell needs an explicit colour: the app's inherited default is set on
// <body> and .metric styles numerals only, so an unstyled cell renders invisibly
// against the white card.
const th: React.CSSProperties = { paddingBottom: 10, borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '12px 0', verticalAlign: 'top', color: '#6B6A64' }

// Same footprint as `inp`, but for values that are shown rather than entered.
const readonlyBox: React.CSSProperties = {
  fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64',
  border: '1px solid #E3E2DC', borderRadius: 8, padding: '5px 10px',
  backgroundColor: '#FAFAF7', boxSizing: 'border-box', width: '100%',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

const frame: React.CSSProperties = {
  border: '1px solid #E3E2DC', borderRadius: 12, padding: 16,
}

/**
 * FX date + rate + lookup button, shared by Production and every shipment.
 * Module scope on purpose: declared inside the page it would be a fresh
 * component type on each render, remounting the inputs and losing focus.
 */
function RateRow({
  fxKey, date, rate, busy, note, onDate, onRate, onFetch,
}: {
  fxKey:   string
  date:    string
  rate:    string
  busy:    boolean
  note?:   string
  onDate:  (v: string) => void
  onRate:  (v: string) => void
  onFetch: () => void
}) {
  return (
    <div>
      <div className="flex gap-3 flex-wrap items-end">
        <div style={{ width: 165 }}>
          <Field label="FX date">
            <DatePicker value={date} onChange={onDate} />
          </Field>
        </div>
        <div style={{ width: 130 }}>
          <Field label="USD → EUR">
            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.0001"
              placeholder="0.0000" value={rate} onChange={e => onRate(e.target.value)} />
          </Field>
        </div>
        <button style={btn} disabled={busy} onClick={onFetch}>
          {busy ? 'Fetching…' : 'Fetch rate'}
        </button>
      </div>
      {note && (
        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#EA6C00', marginTop: 6 }} key={fxKey}>
          {note}
        </p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="label" style={{ display: 'block', marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InboundsPage() {
  const [inbounds, setInbounds] = useState<Inbound[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [draft,    setDraft]    = useState<Draft | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Rate lookup: which field is loading, and any note to show next to it.
  const [fxBusy, setFxBusy] = useState<string | null>(null)
  const [fxNote, setFxNote] = useState<Record<string, string>>({})

  const [partnerDialog, setPartnerDialog] = useState<null | {
    kind: 'supplier' | 'shipping'
    name: string
    apply: (p: Partner) => void
  }>(null)

  const uploadTarget = useRef<string>('')   // '' = production, else shipment id
  const fileRef      = useRef<HTMLInputElement>(null)

  const load = useCallback(async (): Promise<Inbound[]> => {
    try {
      const [inbRes, parRes] = await Promise.all([
        fetch('/api/inbounds'),
        fetch('/api/partners'),
      ])
      const inbJson = await inbRes.json()
      const parJson = await parRes.json()
      if (!inbRes.ok) throw new Error(inbJson.error ?? 'Could not load inbounds')
      setInbounds(inbJson.inbounds)

      // Surfacing this matters: swallowing it once made an empty supplier list
      // look like a missing seed when the database was actually erroring.
      if (parRes.ok) setPartners(parJson.partners)
      else throw new Error(parJson.error ?? 'Could not load suppliers')

      setError(null)
      return inbJson.inbounds as Inbound[]
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load inbounds')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const suppliers = useMemo(() => partners.filter(p => p.is_supplier), [partners])
  const carriers  = useMemo(() => partners.filter(p => p.is_shipping), [partners])

  const current = draft?.id ? inbounds.find(i => i.id === draft.id) : undefined
  const invoices: InboundInvoice[] = current?.invoices ?? []

  // The charge's arrival is the span across its shipments, not its own field.
  const draftShipments = draft ? toShipments(draft) : []
  const plannedSpan    = spanText(arrivalSpan(draftShipments, 'planned'))
  const actualSpan     = spanText(arrivalSpan(draftShipments, 'actual'))

  const checks = draft ? reconcileQuantities(toItems(draft), draftShipments) : []
  const totals = draft ? inboundTotals({ items: toItems(draft), shipments: draftShipments }) : null

  const productionFx = draft ? fxOf(draft.productionFx) : null

  /** Looks up the ECB rate for a date and writes it into the given field. */
  async function fetchRate(key: string, date: string, apply: (rate: string) => void) {
    if (!date) {
      setFxNote(n => ({ ...n, [key]: 'Pick a date first' }))
      return
    }
    setFxBusy(key)
    setFxNote(n => ({ ...n, [key]: '' }))
    try {
      const res  = await fetch(`/api/fx?date=${date}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Rate lookup failed')
      apply(String(json.rate))
      // The ECB only publishes on business days, so a weekend resolves back to
      // the previous one. Say so rather than booking a rate from an unseen day.
      setFxNote(n => ({
        ...n,
        [key]: json.date !== date ? `ECB rate of ${fmtDate(json.date)}` : '',
      }))
    } catch (e) {
      setFxNote(n => ({
        ...n,
        [key]: `${e instanceof Error ? e.message : 'Lookup failed'} — enter it manually`,
      }))
    } finally {
      setFxBusy(null)
    }
  }

  function openPartnerDialog(kind: 'supplier' | 'shipping', apply: (p: Partner) => void) {
    setPartnerDialog({ kind, name: '', apply })
  }

  async function submitPartner() {
    if (!partnerDialog?.name.trim()) return
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerDialog.name,
          is_supplier: partnerDialog.kind === 'supplier',
          is_shipping: partnerDialog.kind === 'shipping',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not add')
      setPartners(p => [...p.filter(x => x.id !== json.partner.id), json.partner]
        .sort((a, b) => a.name.localeCompare(b.name)))
      partnerDialog.apply(json.partner as Partner)
      setPartnerDialog(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add')
    }
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        charge:     draft.charge,
        order_date: draft.orderDate,
        notes:      draft.notes,
        production_fx_usd_eur: productionFx,
        production_fx_date:    draft.productionFxDate || null,
        items:      toItems(draft),
        shipments:  toShipments(draft),
      }
      const res = await fetch(draft.id ? `/api/inbounds/${draft.id}` : '/api/inbounds', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save')

      const fresh = await load()

      if (draft.id) {
        setDraft(null)
      } else {
        // Stay in the editor after the first save so invoices can be uploaded:
        // they need a persisted charge, and filing one under a shipment needs
        // that shipment's id, which only exists now.
        const saved = fresh.find(i => i.id === json.id)
        setDraft(saved ? draftFrom(saved) : null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, charge: string) {
    if (!confirm(`Delete inbound "${charge}"? This also removes its uploaded invoices.`)) return
    setDeleting(id)
    try {
      const res  = await fetch(`/api/inbounds/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not delete')
      if (draft?.id === id) setDraft(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    } finally {
      setDeleting(null)
    }
  }

  function pickFiles(target: string) {
    uploadTarget.current = target
    fileRef.current?.click()
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    const id    = draft?.id
    if (!files?.length || !id) return

    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('file', f))
      if (uploadTarget.current) fd.append('shipment_id', uploadTarget.current)

      const res  = await fetch(`/api/inbounds/${id}/invoices`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openInvoice(inboundId: string, invoiceId: string) {
    try {
      const res  = await fetch(`/api/inbounds/${inboundId}/invoices/${invoiceId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not open invoice')
      window.open(json.url, '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open invoice')
    }
  }

  async function refileInvoice(inboundId: string, invoiceId: string, shipmentId: string) {
    try {
      const res = await fetch(`/api/inbounds/${inboundId}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: shipmentId || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not move invoice')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move invoice')
    }
  }

  async function deleteInvoice(inboundId: string, invoiceId: string) {
    try {
      const res = await fetch(`/api/inbounds/${inboundId}/invoices/${invoiceId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not delete invoice')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete invoice')
    }
  }

  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: G, fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 600, color: '#111110', margin: 0 }}>
          Inbounds
        </h1>
        <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64', marginTop: 6 }}>
          Every goods purchase from order to arrival at the WeShip warehouse.
        </p>
      </div>

      {error && <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#DC2626', marginBottom: 16 }}>{error}</p>}

      <input ref={fileRef} type="file" multiple onChange={upload} style={{ display: 'none' }} />

      {/* ─── List ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          label="Inbounds"
          action={<button style={btnPrimary} onClick={() => setDraft(blankDraft())}>New Inbound</button>}
        />

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} />
          </div>
        ) : inbounds.length === 0 ? (
          <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            No inbounds yet. Add one, or plan a new order in the Inbound Calculator.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Charge',         align: 'left'  },
                    { label: 'Order Date',     align: 'left'  },
                    { label: 'Products',       align: 'left'  },
                    { label: 'Shipments',      align: 'left'  },
                    { label: 'Total (DDP)',    align: 'right' },
                    { label: 'WeShip Arrival', align: 'left'  },
                    { label: '',               align: 'right' },
                  ].map(({ label, align }, i, arr) => (
                    <th key={label || i} className="label"
                      style={{ ...th, textAlign: align as 'left' | 'right', paddingRight: i < arr.length - 1 ? 20 : 0 }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inbounds.map((inb, i) => {
                  const t       = inboundTotals(inb)
                  const actual  = arrivalSpan(inb.shipments, 'actual')
                  const planned = arrivalSpan(inb.shipments, 'planned')
                  return (
                    <tr key={inb.id} style={{
                      borderBottom: i < inbounds.length - 1 ? '1px solid #F0EFE9' : 'none',
                      backgroundColor: draft?.id === inb.id ? '#FAFAF7' : 'transparent',
                    }}>
                      <td style={{ ...td, paddingRight: 20, fontFamily: G, color: '#111110' }}>{inb.charge}</td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>{fmtDate(inb.order_date)}</td>
                      <td style={{ ...td, paddingRight: 20 }}>
                        {inb.items.length === 0 ? '—' : inb.items.map(it => (
                          <span key={it.product_id} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                            <span className="metric" style={{ color: '#111110' }}>{fmtInt(it.quantity)}</span>
                            <span>&nbsp;× {productName(it.product_id)}</span>
                          </span>
                        ))}
                      </td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>
                        {inb.shipments.length === 0
                          ? '—'
                          : inb.shipments.map(sh => shipModeLabel(sh.mode)).join(' + ')}
                      </td>
                      <td className="metric" style={{ ...td, paddingRight: 20, textAlign: 'right', color: '#111110' }}>
                        {fmtEur(t.total)}
                      </td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>
                        {actual
                          ? <span style={{ color: '#111110' }}>{spanText(actual)}</span>
                          : <span style={{ color: '#9E9D98' }}>pending</span>}
                        {planned && (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9E9D98' }}>
                            planned {spanText(planned)}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button style={btn} onClick={() => setDraft(draftFrom(inb))}>Edit</button>
                        <button style={{ ...btnDanger, marginLeft: 6 }} disabled={deleting === inb.id}
                          onClick={() => remove(inb.id, inb.charge)}>
                          {deleting === inb.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Editor ────────────────────────────────────────────────────── */}
      {draft && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <CardHeader label={draft.id ? `Edit ${draft.charge || 'inbound'}` : 'New Inbound'} />

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <Field label="Charge">
                <input style={inp} value={draft.charge} placeholder="e.g. IB-2026-03"
                  onChange={e => setDraft({ ...draft, charge: e.target.value })} />
              </Field>
              <Field label="Order Date">
                <DatePicker value={draft.orderDate} onChange={v => setDraft({ ...draft, orderDate: v })} />
              </Field>
              <Field label="WeShip Arrival (planned)">
                <DateReadout>{plannedSpan}</DateReadout>
              </Field>
              <Field label="WeShip Arrival (actual)">
                <DateReadout>{actualSpan}</DateReadout>
              </Field>
            </div>
            <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 8 }}>
              Arrival is taken from the shipments below — with a split charge the legs land weeks apart.
            </p>

            {/* ─── Production ─────────────────────────────────────────── */}
            <div style={{ marginTop: 32 }}>
              <p className="label" style={{ marginBottom: 10 }}>Production</p>
              <div style={frame}>
                <RateRow
                  fxKey="production"
                  date={draft.productionFxDate}
                  rate={draft.productionFx}
                  busy={fxBusy === 'production'}
                  note={fxNote['production']}
                  onDate={v => setDraft({ ...draft, productionFxDate: v })}
                  onRate={v => setDraft({ ...draft, productionFx: v })}
                  onFetch={() => fetchRate('production', draft.productionFxDate,
                    v => setDraft(d => (d ? { ...d, productionFx: v } : d)))}
                />

                <div style={{ marginTop: 16 }}>
                  {draft.items.length === 0 ? (
                    <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98', marginBottom: 10 }}>
                      No products yet.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                        <thead>
                          <tr>
                            {[
                              { l: 'Product',                  a: 'left'  },
                              { l: 'Quantity',                 a: 'right' },
                              { l: 'Production costs (EXW) $', a: 'right' },
                              { l: '€',                        a: 'right' },
                              { l: '€ per unit',               a: 'right' },
                              { l: 'Supplier',                 a: 'left'  },
                              { l: '',                         a: 'right' },
                            ].map(({ l, a }, i) => (
                              <th key={i} className="label"
                                style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: 14 }}>{l}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {draft.items.map((it, idx) => {
                            const qty     = num(it.quantity)
                            const usd     = num(it.costUsd)
                            const eur     = usdToEur(usd, productionFx)
                            const perUnit = eur !== null && qty ? eur / qty : null
                            const patch = (p: Partial<DraftItem>) => setDraft({
                              ...draft,
                              items: draft.items.map((x, i) => (i === idx ? { ...x, ...p } : x)),
                            })
                            return (
                              <tr key={idx} style={{ borderBottom: idx < draft.items.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                                <td style={{ ...td, paddingRight: 14, minWidth: 180 }}>
                                  <select style={inp} value={it.product_id}
                                    onChange={e => patch({ product_id: e.target.value })}>
                                    <option value="">Select product…</option>
                                    {INBOUND_PRODUCTS.map(p => (
                                      <option key={p.id} value={p.id}
                                        disabled={p.id !== it.product_id && draft.items.some(x => x.product_id === p.id)}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ ...td, paddingRight: 14, width: 110 }}>
                                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
                                    value={it.quantity} onChange={e => patch({ quantity: e.target.value })} />
                                </td>
                                <td style={{ ...td, paddingRight: 14, width: 140 }}>
                                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.01"
                                    value={it.costUsd} onChange={e => patch({ costUsd: e.target.value })} />
                                </td>
                                <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                                  {eur === null ? '—' : fmtEur(eur)}
                                </td>
                                <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                                  {perUnit === null ? '—' : fmtEur(perUnit)}
                                </td>
                                <td style={{ ...td, paddingRight: 14, minWidth: 180 }}>
                                  <select style={inp} value={it.supplierId}
                                    onChange={e => {
                                      if (e.target.value === '__add') {
                                        openPartnerDialog('supplier', p => patch({ supplierId: p.id }))
                                        return
                                      }
                                      patch({ supplierId: e.target.value })
                                    }}>
                                    <option value="">—</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    <option value="__add">+ Add supplier</option>
                                  </select>
                                </td>
                                <td style={{ ...td, textAlign: 'right' }}>
                                  <button style={iconBtn} title="Remove product"
                                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>
                                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                      <path d="M3 3 L11 11 M11 3 L3 11" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button style={btn} onClick={() => setDraft({
                    ...draft,
                    items: [...draft.items, { product_id: '', quantity: '', costUsd: '', supplierId: '' }],
                  })}>
                    + Add product
                  </button>
                </div>
              </div>
            </div>

            {/* ─── IB Shipping ────────────────────────────────────────── */}
            <div style={{ marginTop: 32 }}>
              <p className="label" style={{ marginBottom: 10 }}>IB Shipping</p>

              {draft.shipments.length === 0 ? (
                <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98', marginBottom: 10 }}>
                  No shipments yet. Add one per leg — a charge is often split across air and train.
                </p>
              ) : (
                <div className="flex flex-col gap-3" style={{ marginBottom: 10 }}>
                  {draft.shipments.map((sh, idx) => {
                    const patch = (p: Partial<DraftShipment>) => setDraft({
                      ...draft,
                      shipments: draft.shipments.map((x, i) => (i === idx ? { ...x, ...p } : x)),
                    })
                    const fx = fxOf(sh.fx)
                    return (
                      <div key={idx} style={frame}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                          <span className="label">Shipment {idx + 1}</span>
                          <button style={iconBtn} title="Remove shipment"
                            onClick={() => setDraft({ ...draft, shipments: draft.shipments.filter((_, i) => i !== idx) })}>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <path d="M3 3 L11 11 M11 3 L3 11" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                          <Field label="Mode">
                            <select style={inp} value={sh.mode}
                              onChange={e => patch({ mode: e.target.value as ShipMode })}>
                              {SHIP_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Shipping company">
                            <select style={inp} value={sh.companyId}
                              onChange={e => {
                                if (e.target.value === '__add') {
                                  openPartnerDialog('shipping', p => patch({ companyId: p.id }))
                                  return
                                }
                                patch({ companyId: e.target.value })
                              }}>
                              <option value="">—</option>
                              {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              <option value="__add">+ Add shipping company</option>
                            </select>
                          </Field>
                          <Field label="Shipping costs $">
                            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.01"
                              value={sh.costUsd} onChange={e => patch({ costUsd: e.target.value })} />
                          </Field>
                          <Field label="Shipping costs €">
                            <div className="metric" style={{ ...readonlyBox, textAlign: 'right' }}>
                              {eurOrDash(num(sh.costUsd), fx)}
                            </div>
                          </Field>
                          <Field label="Planned arrival WeShip">
                            <DatePicker value={sh.planned} onChange={v => patch({ planned: v })} />
                          </Field>
                          <Field label="Actual arrival WeShip">
                            <DatePicker value={sh.actual} onChange={v => patch({ actual: v })} align="right" />
                          </Field>
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <RateRow
                            fxKey={`ship-${idx}`}
                            date={sh.fxDate}
                            rate={sh.fx}
                            busy={fxBusy === `ship-${idx}`}
                            note={fxNote[`ship-${idx}`]}
                            onDate={v => patch({ fxDate: v })}
                            onRate={v => patch({ fx: v })}
                            onFetch={() => fetchRate(`ship-${idx}`, sh.fxDate, v => setDraft(d => (d ? {
                              ...d,
                              shipments: d.shipments.map((x, i) => (i === idx ? { ...x, fx: v } : x)),
                            } : d)))}
                          />
                        </div>

                        {/* Same column widths as Production, so the allocation
                            reads as a continuation of the rows above. */}
                        <div style={{ marginTop: 18 }}>
                          <span className="label" style={{ display: 'block', marginBottom: 6 }}>Products on this shipment</span>
                          {draft.items.filter(it => it.product_id).length === 0 ? (
                            <p style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                              Add products under Production first.
                            </p>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                                <thead>
                                  <tr>
                                    {[{ l: 'Product', a: 'left' }, { l: 'Quantity', a: 'right' }].map(({ l, a }, i) => (
                                      <th key={i} className="label"
                                        style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: 14 }}>{l}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {draft.items.filter(it => it.product_id).map((it, i, arr) => (
                                    <tr key={it.product_id}
                                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                                      <td style={{ ...td, paddingRight: 14, minWidth: 180, width: 180 }}>
                                        <div style={readonlyBox}>{productName(it.product_id)}</div>
                                      </td>
                                      <td style={{ ...td, paddingRight: 14, width: 110 }}>
                                        <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
                                          placeholder="0"
                                          value={sh.qty[it.product_id] ?? ''}
                                          onChange={e => patch({ qty: { ...sh.qty, [it.product_id]: e.target.value } })} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <button style={btn} onClick={() => setDraft({
                ...draft,
                shipments: [...draft.shipments, {
                  id: null, mode: 'sea', companyId: '', costUsd: '',
                  fx: '', fxDate: draft.orderDate, planned: '', actual: '', qty: {},
                }],
              })}>
                + Add IB shipping
              </button>

              {/* Allocation mismatches are a hint, not a blocker: a charge is
                  filled in over weeks and has to stay saveable meanwhile. */}
              {checks.filter(c => c.diff !== 0).length > 0 && (
                <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#EA6C00', marginTop: 10 }}>
                  {checks.filter(c => c.diff !== 0).map(c => (
                    `${productName(c.product_id)}: ${fmtInt(c.shipped)} of ${fmtInt(c.ordered)} allocated`
                  )).join(' · ')}
                </p>
              )}
            </div>

            {/* Totals */}
            {totals && (
              <div className="flex items-baseline justify-between flex-wrap gap-2"
                style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid #E3E2DC' }}>
                <span className="label">Total production &amp; IB shipping costs (DDP)</span>
                <span className="metric" style={{ fontFamily: G, fontSize: '1rem', fontWeight: 600, color: '#111110' }}>
                  {fmtEur(totals.total)}
                </span>
              </div>
            )}

            {/* Invoices */}
            <div style={{ marginTop: 32 }}>
              <div className="flex items-center justify-between flex-wrap gap-y-2" style={{ marginBottom: 10 }}>
                <span className="label">Invoices</span>
                {draft.id && (
                  <button style={btn} disabled={uploading} onClick={() => pickFiles('')}>
                    {uploading ? 'Uploading…' : '+ Upload invoice'}
                  </button>
                )}
              </div>

              {!draft.id ? (
                <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
                  Save the inbound first — invoices are stored per charge.
                </p>
              ) : invoices.length === 0 ? (
                <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
                  No invoices uploaded yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {invoices.map(inv => (
                    <div key={inv.id} className="flex items-center gap-2 flex-wrap"
                      style={{ fontFamily: G, fontSize: '0.8125rem', color: '#111110' }}>
                      <span style={{ minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.filename}
                      </span>
                      <select
                        style={{ ...inp, width: 190 }}
                        value={inv.shipment_id ?? ''}
                        onChange={e => refileInvoice(draft.id!, inv.id, e.target.value)}
                      >
                        <option value="">Production</option>
                        {draft.shipments.filter(s => s.id).map((s, i) => (
                          <option key={s.id} value={s.id!}>
                            Shipment {i + 1} ({shipModeLabel(s.mode)})
                          </option>
                        ))}
                      </select>
                      <button style={btn} onClick={() => openInvoice(draft.id!, inv.id)}>Open</button>
                      <button style={btnDanger} onClick={() => deleteInvoice(draft.id!, inv.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginTop: 28 }}>
              <Field label="Notes">
                <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={draft.notes}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Delays, quality issues, Chinese New Year, deviations from plan…" />
              </Field>
            </div>

            <div className="flex gap-2" style={{ marginTop: 20 }}>
              <button style={btnPrimary} disabled={saving} onClick={save}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create inbound'}
              </button>
              <button style={btn} onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={!!partnerDialog}
        title={partnerDialog?.kind === 'shipping' ? 'Add shipping company' : 'Add supplier'}
        onClose={() => setPartnerDialog(null)}
        footer={
          <>
            <button style={btn} onClick={() => setPartnerDialog(null)}>Cancel</button>
            <button style={btnPrimary} disabled={!partnerDialog?.name.trim()} onClick={submitPartner}>Add</button>
          </>
        }
      >
        <Field label="Name">
          <input
            style={inp}
            value={partnerDialog?.name ?? ''}
            placeholder={partnerDialog?.kind === 'shipping' ? 'e.g. Shenzhen Amanda' : 'e.g. Quanzhou Pengxin Bags'}
            onChange={e => setPartnerDialog(d => (d ? { ...d, name: e.target.value } : d))}
            onKeyDown={e => { if (e.key === 'Enter') submitPartner() }}
          />
        </Field>
      </Modal>
    </main>
  )
}
