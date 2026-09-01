'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { DatePicker, DateReadout } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Modal'
import {
  G, inp, btn, btnField, btnAccent, btnLarge, iconBtnDanger,
  COL_PRODUCT, COL_CHARGE, COL_QTY, fmtEur, fmtInt, fmtBytes, btnLargeSecondary,
} from '@/components/ui/formStyles'
import { Select } from '@/components/ui/Select'
import { Field } from '@/components/ui/Field'
import { SectionHeading } from '@/components/ui/SectionHeading'
import {
  INBOUND_PRODUCTS, SHIP_MODES, shipModeLabel, inboundTotals, arrivalSpan,
  reconcileQuantities, productName, usdToEur, perProductSummary,
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
  charge:     string
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
  name:         string
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
    id: null, name: '', orderDate: today,
    productionFx: '', productionFxDate: today,
    notes: '', items: [], shipments: [],
  }
}

function draftFrom(inb: Inbound): Draft {
  return {
    id:        inb.id,
    name:      inb.name,
    orderDate: inb.order_date,
    productionFx:     inb.production_fx_usd_eur != null ? String(inb.production_fx_usd_eur) : '',
    productionFxDate: inb.production_fx_date ?? inb.order_date,
    notes:     inb.notes,
    items: inb.items.map(it => ({
      product_id: it.product_id,
      charge:     it.charge,
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
    charge:              it.charge,
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

// Filled panel, matching the section blocks on the settings page
// (app/dashboard/settings/page.tsx:187) — reads as an area rather than a box.
const frame: React.CSSProperties = {
  backgroundColor: '#F5F4F0', borderRadius: 12, padding: '16px 18px',
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
        <button style={btnField} disabled={busy} onClick={onFetch}>
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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 3.5 H11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 3.5 V2.4 H8.5 V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3.6 3.5 L4.2 11.4 H9.8 L10.4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 5.6 V9.4 M8 5.6 V9.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
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

  const draftItems = draft ? toItems(draft) : []
  const checks     = draft ? reconcileQuantities(draftItems, draftShipments) : []
  const totals     = draft ? inboundTotals({ items: draftItems, shipments: draftShipments }) : null
  const summary    = perProductSummary({ items: draftItems, shipments: draftShipments })

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
        name:       draft.name,
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

  async function remove(id: string, name: string) {
    if (!confirm(`Delete inbound "${name}"? This also removes its uploaded invoices.`)) return
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
          action={<button style={btnLarge} onClick={() => setDraft(blankDraft())}>New inbound</button>}
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
                    { label: 'Name',           align: 'left'  },
                    { label: 'Order Date',     align: 'left'  },
                    { label: 'Products',       align: 'left'  },
                    { label: 'Shipments',      align: 'left'  },
                    { label: 'Total (DDP)',    align: 'right' },
                    { label: 'WeShip Arrival', align: 'left'  },
                    { label: '',               align: 'right' },
                  ].map(({ label, align }, i, arr) => (
                    <th key={label || i} className="label"
                      style={{
                        ...th, textAlign: align as 'left' | 'right',
                        paddingLeft:  i === 0 ? 4 : 0,
                        paddingRight: i === arr.length - 1 ? 4 : 20,
                      }}>
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
                      <td style={{ ...td, paddingLeft: 4, paddingRight: 20, fontFamily: G, color: '#111110' }}>{inb.name}</td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>{fmtDate(inb.order_date)}</td>
                      <td style={{ ...td, paddingRight: 20 }}>
                        {inb.items.length === 0 ? '—' : inb.items.map(it => (
                          <span key={it.product_id} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                            <span className="metric" style={{ color: '#111110' }}>{fmtInt(it.quantity)}</span>
                            <span>&nbsp;× {productName(it.product_id)}</span>
                            {it.charge && (
                              <span style={{ color: '#9E9D98' }}>&nbsp;· {it.charge}</span>
                            )}
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
                      <td style={{ ...td, paddingRight: 4, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="flex items-center justify-end gap-2">
                          <button style={btn} onClick={() => setDraft(draftFrom(inb))}>Edit</button>
                          <button style={iconBtnDanger} title={`Delete ${inb.name}`}
                            disabled={deleting === inb.id}
                            onClick={() => remove(inb.id, inb.name)}>
                            <TrashIcon />
                          </button>
                        </div>
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
            <CardHeader label={draft.id ? `Edit ${draft.name || 'inbound'}` : 'New inbound'} />

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <Field label="Name">
                <input style={inp} value={draft.name} placeholder="e.g. Spring restock 2026"
                  onChange={e => setDraft({ ...draft, name: e.target.value })} />
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
            <div>
              <SectionHeading>Production</SectionHeading>
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

                <div style={{ marginTop: 28 }}>
                  {draft.items.length === 0 ? (
                    <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98', marginBottom: 10 }}>
                      No products yet.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                        {/* Widths are pinned so the per-shipment allocation below
                            lines up column for column with these rows. */}
                        <colgroup>
                          <col style={{ width: COL_PRODUCT }} />
                          <col style={{ width: COL_CHARGE }} />
                          <col style={{ width: COL_QTY }} />
                          <col style={{ width: 150 }} />
                          <col /><col /><col />
                          <col style={{ width: 56 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            {[
                              { l: 'Product',                  a: 'left'  },
                              { l: 'Charge',                   a: 'left'  },
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
                              <tr key={idx}>
                                <td style={{ ...td, paddingRight: 14 }}>
                                  <Select value={it.product_id} onChange={v => patch({ product_id: v })}>
                                    <option value="">Select product…</option>
                                    {INBOUND_PRODUCTS.map(p => (
                                      <option key={p.id} value={p.id}
                                        disabled={p.id !== it.product_id && draft.items.some(x => x.product_id === p.id)}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </Select>
                                </td>
                                <td style={{ ...td, paddingRight: 14 }}>
                                  <input style={inp} value={it.charge} placeholder="e.g. IB-2026-03"
                                    onChange={e => patch({ charge: e.target.value })} />
                                </td>
                                <td style={{ ...td, paddingRight: 14 }}>
                                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
                                    value={it.quantity} onChange={e => patch({ quantity: e.target.value })} />
                                </td>
                                <td style={{ ...td, paddingRight: 14 }}>
                                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.01"
                                    value={it.costUsd} onChange={e => patch({ costUsd: e.target.value })} />
                                </td>
                                <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                                  {eur === null ? '—' : fmtEur(eur)}
                                </td>
                                <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                                  {perUnit === null ? '—' : fmtEur(perUnit)}
                                </td>
                                <td style={{ ...td, paddingRight: 14 }}>
                                  <Select value={it.supplierId} onChange={v => {
                                    if (v === '__add') {
                                      openPartnerDialog('supplier', p => patch({ supplierId: p.id }))
                                      return
                                    }
                                    patch({ supplierId: v })
                                  }}>
                                    <option value="">—</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    <option value="__add">+ Add supplier</option>
                                  </Select>
                                </td>
                                <td style={{ ...td, textAlign: 'right' }}>
                                  <button style={iconBtnDanger} title="Remove product"
                                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>
                                    <TrashIcon />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button style={btnAccent} onClick={() => setDraft({
                    ...draft,
                    items: [...draft.items, { product_id: '', charge: '', quantity: '', costUsd: '', supplierId: '' }],
                  })}>
                    + Add product
                  </button>
                </div>
              </div>
            </div>

            {/* ─── IB Shipping ────────────────────────────────────────── */}
            <div>
              <SectionHeading>IB Shipping</SectionHeading>

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
                          <button style={iconBtnDanger} title="Remove shipment"
                            onClick={() => setDraft({ ...draft, shipments: draft.shipments.filter((_, i) => i !== idx) })}>
                            <TrashIcon />
                          </button>
                        </div>

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

                        <div className="grid gap-3" style={{ marginTop: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                          <Field label="Type">
                            <Select value={sh.mode} onChange={v => patch({ mode: v as ShipMode })}>
                              {SHIP_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </Select>
                          </Field>
                          <Field label="Shipping company">
                            <Select value={sh.companyId} onChange={v => {
                              if (v === '__add') {
                                openPartnerDialog('shipping', p => patch({ companyId: p.id }))
                                return
                              }
                              patch({ companyId: v })
                            }}>
                              <option value="">—</option>
                              {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              <option value="__add">+ Add shipping company</option>
                            </Select>
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

                        {/* Same column widths as Production, so the allocation
                            reads as a continuation of the rows above. */}
                        <div style={{ marginTop: 28 }}>
                          <span className="label" style={{ display: 'block', marginBottom: 10 }}>Products on this shipment</span>
                          {draft.items.filter(it => it.product_id).length === 0 ? (
                            <p style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98' }}>
                              Add products under Production first.
                            </p>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                                {/* Same widths as the production table above, so
                                    the two read as one continuous grid. */}
                                <colgroup>
                                  <col style={{ width: COL_PRODUCT }} />
                                  <col style={{ width: COL_CHARGE }} />
                                  <col style={{ width: COL_QTY }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    {[{ l: 'Product', a: 'left' }, { l: 'Charge', a: 'left' }, { l: 'Quantity', a: 'right' }].map(({ l, a }, i) => (
                                      <th key={i} className="label"
                                        style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: 14 }}>{l}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {draft.items.filter(it => it.product_id).map(it => (
                                    <tr key={it.product_id}>
                                      <td style={{ ...td, paddingRight: 14 }}>
                                        <div style={readonlyBox}>{productName(it.product_id)}</div>
                                      </td>
                                      {/* Read-only echo of the production row, so both tables
                                          keep the same columns and line up. */}
                                      <td style={{ ...td, paddingRight: 14 }}>
                                        <div style={readonlyBox}>{it.charge || '—'}</div>
                                      </td>
                                      <td style={{ ...td, paddingRight: 14 }}>
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
              <button style={btnAccent} onClick={() => setDraft({
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

            {/* Totals + per-product breakdown */}
            {totals && (
              <div style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid #E3E2DC' }}>
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <span className="label">Total production &amp; IB shipping costs (DDP)</span>
                  <span className="metric" style={{ fontFamily: G, fontSize: '1rem', fontWeight: 600, color: '#111110' }}>
                    {fmtEur(totals.total)}
                  </span>
                </div>

                {summary.products.length > 0 && (
                  <div style={{ ...frame, marginTop: 16, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                      <thead>
                        <tr>
                          {[
                            { l: 'Product',        a: 'left'  },
                            { l: 'Quantity',       a: 'right' },
                            { l: 'Production / pc', a: 'right' },
                            { l: 'Shipping / pc',  a: 'right' },
                            { l: 'Landed / pc',    a: 'right' },
                            { l: 'Total',          a: 'right' },
                          ].map(({ l, a }, i) => (
                            <th key={i} className="label"
                              style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: i < 5 ? 20 : 0 }}>{l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.products.map(pc => (
                          <tr key={pc.product_id}>
                            <td style={{ ...td, padding: '10px 20px 10px 0', color: '#111110' }}>
                              {productName(pc.product_id)}
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 20px 10px 0', textAlign: 'right' }}>
                              {fmtInt(pc.quantity)}
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 20px 10px 0', textAlign: 'right' }}>
                              {pc.productionPerUnit === null ? '—' : fmtEur(pc.productionPerUnit)}
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 20px 10px 0', textAlign: 'right' }}>
                              {pc.shippingPerUnit === null ? '—' : fmtEur(pc.shippingPerUnit)}
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 20px 10px 0', textAlign: 'right', color: '#111110', fontWeight: 500 }}>
                              {pc.landedPerUnit === null ? '—' : fmtEur(pc.landedPerUnit)}
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 0', textAlign: 'right' }}>
                              {fmtEur(pc.productionEur + pc.shippingEur)}
                            </td>
                          </tr>
                        ))}

                        {/* Freight not yet tied to a product — shown so the rows
                            always add up to the DDP total instead of quietly
                            falling short. */}
                        {summary.unallocated > 0.005 && (
                          <tr>
                            <td colSpan={5} style={{ ...td, padding: '10px 20px 10px 0', color: '#EA6C00' }}>
                              Unallocated freight — not yet assigned to a product
                            </td>
                            <td className="metric" style={{ ...td, padding: '10px 0', textAlign: 'right', color: '#EA6C00' }}>
                              {fmtEur(summary.unallocated)}
                            </td>
                          </tr>
                        )}

                        <tr>
                          <td colSpan={5} className="label"
                            style={{ padding: '12px 20px 0 0', borderTop: '1px solid #E3E2DC' }}>
                            Total production &amp; IB shipping costs (DDP)
                          </td>
                          <td className="metric" style={{
                            padding: '12px 0 0', textAlign: 'right', borderTop: '1px solid #E3E2DC',
                            color: '#111110', fontWeight: 600,
                          }}>
                            {fmtEur(summary.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Invoices */}
            <div>
              <SectionHeading
                action={draft.id ? (
                  <button style={btnAccent} disabled={uploading} onClick={() => pickFiles('')}>
                    {uploading ? 'Uploading…' : '+ Upload invoice'}
                  </button>
                ) : undefined}
              >
                Invoices
              </SectionHeading>

              {!draft.id ? (
                <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
                  Save the inbound first — invoices are stored per charge.
                </p>
              ) : invoices.length === 0 ? (
                <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
                  No invoices uploaded yet.
                </p>
              ) : (
                <div style={{ ...frame, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                    <colgroup>
                      <col /><col style={{ width: 210 }} />
                      <col style={{ width: 130 }} /><col style={{ width: 90 }} />
                      <col style={{ width: 120 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {[
                          { l: 'File',        a: 'left'  },
                          { l: 'Assigned to', a: 'left'  },
                          { l: 'Uploaded',    a: 'left'  },
                          { l: 'Size',        a: 'right' },
                          { l: '',            a: 'right' },
                        ].map(({ l, a }, i, arr) => (
                          <th key={i} className="label"
                            style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: i < arr.length - 1 ? 16 : 0 }}>
                            {l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}>
                          <td style={{ ...td, paddingRight: 16, color: '#111110', maxWidth: 260,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.filename}
                          </td>
                          <td style={{ ...td, paddingRight: 16 }}>
                            <Select
                              value={inv.shipment_id ?? ''}
                              onChange={v => refileInvoice(draft.id!, inv.id, v)}
                            >
                              <option value="">Production</option>
                              {draft.shipments.filter(sh => sh.id).map((sh, i) => (
                                <option key={sh.id} value={sh.id!}>
                                  Shipment {i + 1} ({shipModeLabel(sh.mode)})
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td style={{ ...td, paddingRight: 16, whiteSpace: 'nowrap' }}>
                            {fmtDate(inv.uploaded_at.slice(0, 10))}
                          </td>
                          <td className="metric" style={{ ...td, paddingRight: 16, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {fmtBytes(inv.size_bytes)}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <div className="flex items-center justify-end gap-2">
                              <button style={btn} onClick={() => openInvoice(draft.id!, inv.id)}>Open</button>
                              <button style={iconBtnDanger} title={`Remove ${inv.filename}`}
                                onClick={() => deleteInvoice(draft.id!, inv.id)}>
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              <button style={btnLarge} disabled={saving} onClick={save}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create inbound'}
              </button>
              <button style={btnLargeSecondary} onClick={() => setDraft(null)}>Cancel</button>
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
            <button style={btnLargeSecondary} onClick={() => setPartnerDialog(null)}>Cancel</button>
            <button style={btnLarge} disabled={!partnerDialog?.name.trim()} onClick={submitPartner}>Add</button>
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
