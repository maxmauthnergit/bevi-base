'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { G, inp, btn, btnPrimary, btnDanger, iconBtn, fmtEur, fmtInt } from '@/components/ui/formStyles'
import {
  INBOUND_PRODUCTS, SHIP_MODES, inboundTotals, allocateByQuantity, productName,
  type Inbound, type InboundItem, type InvoiceKind,
} from '@/lib/inbounds'
import { fmtDate } from '@/lib/inbound-calc'

// ─── Draft (all inputs kept as strings — empty fields stay empty) ────────────

interface DraftItem { selected: boolean; quantity: string; production: string; shipping: string }

interface Draft {
  id:                      string | null
  charge_no:               string
  order_date:              string
  shipping_mode:           string
  weship_arrival_date:     string
  planned_weship_date_min: string
  planned_weship_date_max: string
  notes:                   string
  items:                   Record<string, DraftItem>
}

const emptyItem: DraftItem = { selected: false, quantity: '', production: '', shipping: '' }

function blankDraft(): Draft {
  return {
    id: null,
    charge_no: '',
    order_date: new Date().toISOString().slice(0, 10),
    shipping_mode: '',
    weship_arrival_date: '',
    planned_weship_date_min: '',
    planned_weship_date_max: '',
    notes: '',
    items: Object.fromEntries(INBOUND_PRODUCTS.map(p => [p.id, { ...emptyItem }])),
  }
}

function draftFrom(inb: Inbound): Draft {
  const items = Object.fromEntries(INBOUND_PRODUCTS.map(p => [p.id, { ...emptyItem }])) as Record<string, DraftItem>
  for (const it of inb.items) {
    if (!items[it.product_id]) continue
    items[it.product_id] = {
      selected: true,
      quantity: String(it.quantity),
      production: String(it.production_cost_eur),
      shipping: String(it.shipping_cost_eur),
    }
  }
  return {
    id: inb.id,
    charge_no: inb.charge_no,
    order_date: inb.order_date,
    shipping_mode: inb.shipping_mode ?? '',
    weship_arrival_date: inb.weship_arrival_date ?? '',
    planned_weship_date_min: inb.planned_weship_date_min ?? '',
    planned_weship_date_max: inb.planned_weship_date_max ?? '',
    notes: inb.notes,
    items,
  }
}

function draftItems(d: Draft): InboundItem[] {
  return INBOUND_PRODUCTS
    .filter(p => d.items[p.id]?.selected)
    .map(p => ({
      product_id: p.id,
      quantity: Number(d.items[p.id].quantity) || 0,
      production_cost_eur: Number(d.items[p.id].production) || 0,
      shipping_cost_eur: Number(d.items[p.id].shipping) || 0,
    }))
}

// ─── Small presentational bits ───────────────────────────────────────────────

function DocIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 1.5 L8.5 1.5 L11 4 L11 12.5 L3.5 12.5 Z"
        stroke={filled ? '#0D8585' : '#D4D3CD'} strokeWidth="1.2" strokeLinejoin="round"
        fill={filled ? 'rgba(125,239,239,0.25)' : 'none'} />
      <path d="M8.5 1.5 L8.5 4 L11 4" stroke={filled ? '#0D8585' : '#D4D3CD'} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

const th: React.CSSProperties = {
  paddingBottom: 10,
  borderBottom: '1px solid #E3E2DC',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = { padding: '12px 0', verticalAlign: 'top' }

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InboundsPage() {
  const [inbounds, setInbounds] = useState<Inbound[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [draft,    setDraft]    = useState<Draft | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [shippingTotal, setShippingTotal] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const uploadKind = useRef<InvoiceKind>('production')
  const fileRef    = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/inbounds')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load inbounds')
      setInbounds(json.inbounds)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load inbounds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        charge_no:               draft.charge_no,
        order_date:              draft.order_date,
        shipping_mode:           draft.shipping_mode || null,
        weship_arrival_date:     draft.weship_arrival_date || null,
        planned_weship_date_min: draft.planned_weship_date_min || null,
        planned_weship_date_max: draft.planned_weship_date_max || null,
        notes:                   draft.notes,
        items:                   draftItems(draft),
      }
      const res = await fetch(draft.id ? `/api/inbounds/${draft.id}` : '/api/inbounds', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save')
      setDraft(null)
      setShippingTotal('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, chargeNo: string) {
    if (!confirm(`Delete inbound "${chargeNo}"? This also removes its uploaded invoices.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/inbounds/${id}`, { method: 'DELETE' })
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

  function pickFile(kind: InvoiceKind) {
    uploadKind.current = kind
    fileRef.current?.click()
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const id   = draft?.id
    if (!file || !id) return

    const kind = uploadKind.current
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      const res  = await fetch(`/api/inbounds/${id}/invoice`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openInvoice(id: string, kind: InvoiceKind) {
    try {
      const res  = await fetch(`/api/inbounds/${id}/invoice?kind=${kind}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not open invoice')
      window.open(json.url, '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open invoice')
    }
  }

  async function removeInvoice(id: string, kind: InvoiceKind) {
    try {
      const res = await fetch(`/api/inbounds/${id}/invoice?kind=${kind}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not remove invoice')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove invoice')
    }
  }

  function distributeShipping() {
    if (!draft) return
    const total = Number(shippingTotal)
    if (!Number.isFinite(total) || total <= 0) return

    const items  = draftItems(draft)
    const shares = allocateByQuantity(items, total)

    setDraft(d => {
      if (!d) return d
      const next = { ...d.items }
      items.forEach((it, i) => {
        next[it.product_id] = { ...next[it.product_id], shipping: String(shares[i]) }
      })
      return { ...d, items: next }
    })
  }

  const editingRow = draft?.id ?? null
  const current    = draft?.id ? inbounds.find(i => i.id === draft.id) : undefined

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

      {error && (
        <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#DC2626', marginBottom: 16 }}>{error}</p>
      )}

      <input ref={fileRef} type="file" onChange={upload} style={{ display: 'none' }} />

      <Card>
        <CardHeader
          label="Inbounds"
          action={
            <button
              style={btnPrimary}
              onClick={() => { setDraft(blankDraft()); setShippingTotal('') }}
            >
              New Inbound
            </button>
          }
        />

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton height={14} />
          </div>
        ) : inbounds.length === 0 && !draft ? (
          <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            No inbounds yet. Add one, or plan a new order in the Inbound Calculator.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Charge #',       align: 'left'  },
                    { label: 'Order Date',     align: 'left'  },
                    { label: 'Products',       align: 'left'  },
                    { label: 'Production',     align: 'right' },
                    { label: 'Shipping',       align: 'right' },
                    { label: 'Total',          align: 'right' },
                    { label: 'WeShip Arrival', align: 'left'  },
                    { label: 'Invoices',       align: 'left'  },
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
                  const t    = inboundTotals(inb.items)
                  const last = i === inbounds.length - 1 && !draft
                  return (
                    <tr key={inb.id} style={{
                      borderBottom: last ? 'none' : '1px solid #F0EFE9',
                      backgroundColor: editingRow === inb.id ? '#FAFAF7' : 'transparent',
                    }}>
                      <td style={{ ...td, paddingRight: 20, fontFamily: G, color: '#111110' }}>{inb.charge_no}</td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>{fmtDate(inb.order_date)}</td>
                      <td style={{ ...td, paddingRight: 20 }}>
                        {inb.items.length === 0
                          ? <span style={{ color: '#9E9D98' }}>—</span>
                          : inb.items.map(it => (
                            <span key={it.product_id} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                              <span className="metric">{fmtInt(it.quantity)}</span>
                              <span style={{ color: '#6B6A64' }}>&nbsp;× {productName(it.product_id)}</span>
                            </span>
                          ))}
                      </td>
                      <td className="metric" style={{ ...td, paddingRight: 20, textAlign: 'right' }}>{fmtEur(t.production)}</td>
                      <td className="metric" style={{ ...td, paddingRight: 20, textAlign: 'right' }}>{fmtEur(t.shipping)}</td>
                      <td className="metric" style={{ ...td, paddingRight: 20, textAlign: 'right', color: '#111110' }}>{fmtEur(t.total)}</td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>
                        {inb.weship_arrival_date
                          ? fmtDate(inb.weship_arrival_date)
                          : <span style={{ color: '#9E9D98' }}>pending</span>}
                        {(inb.planned_weship_date_min || inb.planned_weship_date_max) && (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9E9D98' }}>
                            planned {fmtDate(inb.planned_weship_date_min)} – {fmtDate(inb.planned_weship_date_max)}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, paddingRight: 20 }}>
                        <div className="flex items-center gap-1">
                          {(['production', 'shipping'] as InvoiceKind[]).map(kind => {
                            const has = kind === 'production' ? !!inb.production_invoice_path : !!inb.shipping_invoice_path
                            return (
                              <button
                                key={kind}
                                style={{ ...iconBtn, cursor: has ? 'pointer' : 'default' }}
                                title={`${kind === 'production' ? 'Production' : 'Shipping'} invoice${has ? '' : ' — not uploaded'}`}
                                onClick={() => has && openInvoice(inb.id, kind)}
                              >
                                <DocIcon filled={has} />
                              </button>
                            )
                          })}
                          {inb.notes && (
                            <span title={inb.notes} style={{ fontSize: '0.6875rem', color: '#9E9D98', marginLeft: 2 }}>note</span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button style={btn} onClick={() => { setDraft(draftFrom(inb)); setShippingTotal('') }}>Edit</button>
                        <button
                          style={{ ...btnDanger, marginLeft: 6 }}
                          disabled={deleting === inb.id}
                          onClick={() => remove(inb.id, inb.charge_no)}
                        >
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

      {draft && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <CardHeader label={draft.id ? `Edit ${draft.charge_no || 'inbound'}` : 'New Inbound'} />

            {/* Header fields */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <Field label="Charge #">
                <input style={inp} value={draft.charge_no}
                  onChange={e => setDraft({ ...draft, charge_no: e.target.value })} placeholder="e.g. IB-2026-03" />
              </Field>
              <Field label="Order Date">
                <input style={inp} type="date" value={draft.order_date}
                  onChange={e => setDraft({ ...draft, order_date: e.target.value })} />
              </Field>
              <Field label="Shipping Mode">
                <select style={inp} value={draft.shipping_mode}
                  onChange={e => setDraft({ ...draft, shipping_mode: e.target.value })}>
                  <option value="">—</option>
                  {SHIP_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="WeShip Arrival">
                <input style={inp} type="date" value={draft.weship_arrival_date}
                  onChange={e => setDraft({ ...draft, weship_arrival_date: e.target.value })} />
              </Field>
              <Field label="Planned (earliest)">
                <input style={inp} type="date" value={draft.planned_weship_date_min}
                  onChange={e => setDraft({ ...draft, planned_weship_date_min: e.target.value })} />
              </Field>
              <Field label="Planned (latest)">
                <input style={inp} type="date" value={draft.planned_weship_date_max}
                  onChange={e => setDraft({ ...draft, planned_weship_date_max: e.target.value })} />
              </Field>
            </div>

            {/* Products */}
            <p className="label" style={{ marginBottom: 10 }}>Products in this inbound</p>
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    {['', 'Product', 'Quantity', 'Production €', 'Shipping €', 'Per unit'].map((l, i) => (
                      <th key={i} className="label" style={{ ...th, textAlign: i > 1 ? 'right' : 'left', paddingRight: 16 }}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INBOUND_PRODUCTS.map((p, i) => {
                    const it   = draft.items[p.id]
                    const qty  = Number(it.quantity) || 0
                    const unit = qty ? ((Number(it.production) || 0) + (Number(it.shipping) || 0)) / qty : null
                    return (
                      <tr key={p.id} style={{ borderBottom: i < INBOUND_PRODUCTS.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                        <td style={{ ...td, paddingRight: 12, width: 28 }}>
                          <input type="checkbox" checked={it.selected}
                            onChange={e => setDraft({
                              ...draft,
                              items: { ...draft.items, [p.id]: { ...it, selected: e.target.checked } },
                            })} />
                        </td>
                        <td style={{ ...td, paddingRight: 16, color: it.selected ? '#111110' : '#9E9D98' }}>{p.name}</td>
                        {(['quantity', 'production', 'shipping'] as const).map(field => (
                          <td key={field} style={{ ...td, paddingRight: 16, width: 130 }}>
                            <input
                              style={{ ...inp, textAlign: 'right' }}
                              type="number"
                              min="0"
                              step={field === 'quantity' ? '1' : '0.01'}
                              disabled={!it.selected}
                              value={it[field]}
                              onChange={e => setDraft({
                                ...draft,
                                items: { ...draft.items, [p.id]: { ...it, [field]: e.target.value } },
                              })}
                            />
                          </td>
                        ))}
                        <td className="metric" style={{ ...td, textAlign: 'right', color: '#6B6A64', whiteSpace: 'nowrap' }}>
                          {unit === null ? '—' : fmtEur(unit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Freight arrives as one invoice for the whole charge, not per product. */}
            <div className="flex items-end gap-3 flex-wrap mb-6">
              <div style={{ width: 180 }}>
                <Field label="Shipping total €">
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.01"
                    value={shippingTotal} onChange={e => setShippingTotal(e.target.value)} placeholder="0.00" />
                </Field>
              </div>
              <button style={btn} onClick={distributeShipping}>Distribute by quantity</button>
              <span style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', paddingBottom: 6 }}>
                Splits one freight invoice across the selected products; each line stays editable.
              </span>
            </div>

            {/* Invoices */}
            <p className="label" style={{ marginBottom: 10 }}>Invoices</p>
            {draft.id ? (
              <div className="flex gap-6 flex-wrap mb-6">
                {(['production', 'shipping'] as InvoiceKind[]).map(kind => {
                  const path = kind === 'production' ? current?.production_invoice_path : current?.shipping_invoice_path
                  return (
                    <div key={kind} className="flex items-center gap-2">
                      <DocIcon filled={!!path} />
                      <span style={{ fontFamily: G, fontSize: '0.8125rem', color: path ? '#111110' : '#9E9D98' }}>
                        {kind === 'production' ? 'Production invoice' : 'Shipping invoice'}
                      </span>
                      <button style={btn} disabled={uploading === kind} onClick={() => pickFile(kind)}>
                        {uploading === kind ? 'Uploading…' : path ? 'Replace' : 'Upload'}
                      </button>
                      {path && (
                        <>
                          <button style={btn} onClick={() => openInvoice(draft.id!, kind)}>Open</button>
                          <button style={btnDanger} onClick={() => removeInvoice(draft.id!, kind)}>Remove</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98', marginBottom: 24 }}>
                Save the inbound first — invoices are stored per charge.
              </p>
            )}

            {/* Notes */}
            <div className="mb-6">
              <Field label="Notes">
                <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={draft.notes}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Delays, quality issues, Chinese New Year, deviations from plan…" />
              </Field>
            </div>

            <div className="flex gap-2">
              <button style={btnPrimary} disabled={saving} onClick={save}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create inbound'}
              </button>
              <button style={btn} onClick={() => { setDraft(null); setShippingTotal('') }}>Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </main>
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
