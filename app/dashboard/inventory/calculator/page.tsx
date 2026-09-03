'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { DatePicker, DateReadout } from '@/components/ui/DatePicker'
import { TrashIcon } from '@/components/ui/TrashIcon'
import { PlusIcon } from '@/components/ui/PlusIcon'
import { CopyIcon } from '@/components/ui/CopyIcon'
import { NumberInput } from '@/components/ui/NumberInput'
import { Modal } from '@/components/ui/Modal'
import { ShipModeIcon, ShipModeLabel, modeColor } from '@/components/ui/ShipMode'
import { RateRow } from '@/components/ui/RateRow'
import { useFxRate } from '@/hooks/useFxRate'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import {
  G, inp, btn, btnAccent, btnLarge, btnLargeSecondary, iconBtnDanger, iconBtnGrey,
  COL_PRODUCT, COL_QTY, fmtEur, fmtInt, readout, SECTION_GAP,
} from '@/components/ui/formStyles'
import { StockProjectionChart, type ModeBranch } from '@/components/charts/StockProjectionChart'
import { CALCULATOR_PRODUCTS, productName, usdToEur, type Inbound, type ShipMode } from '@/lib/inbounds'
import { projectStock, unitsOn, type Restock } from '@/lib/stock-projection'
import {
  DEFAULT_CALC_CONFIG, calculateAll, productionDaysFor,
  fmtDate, todayIso, daysBetween,
  type CalcConfig, type ModeResult,
} from '@/lib/inbound-calc'

const PHASE_COLOR: Record<string, string> = {
  production:   '#3A3A38',
  preDeparture: '#9E9D98',
  transit:      '#0D8585',
  weship:       '#EA6C00',
}

const PHASE_LABEL: [string, string][] = [
  ['production',   'Production'],
  ['preDeparture', 'Pre-departure'],
  ['transit',      'Transit'],
  ['weship',       'WeShip handling'],
]

/** Days of curve drawn past the last arrival, so the restock is visible landing. */
const FORECAST_TAIL_DAYS = 21
const FORECAST_MIN_DAYS  = 90

// ─── Stored calculation ──────────────────────────────────────────────────────
// Saved in `inbound_scenarios` (name + payload JSONB) — the same table the
// scenario buttons used, so nothing has to be migrated.

/** Amounts are strings so a cleared field stays cleared while typing. */
interface DraftItem {
  productId: string
  quantity:  string
  /** EXW total for the position in USD — what the supplier quotes, as in Inbounds. */
  priceUsd:  string
}

interface Draft {
  id:             string | null
  name:           string
  orderDate:      string
  items:          DraftItem[]
  /** Empty means "follow the tier for this quantity". */
  productionDays: string
  /** One rate for the whole calculation: it converts production AND freight. */
  fxRate:         string
  fxDate:         string
}

interface CalcPayload {
  orderDate:      string
  items?:         DraftItem[]
  /** Shape written before quantities became rows; still read so old saves open. */
  quantities?:    Record<string, string>
  productionDays: string
  fxRate?:        string
  fxDate?:        string
  config:         CalcConfig
}

interface Calculation { id: string; name: string; payload: CalcPayload; created_at: string }

interface InventoryRow {
  sku:             string
  units:           number
  avg_daily_sales: number
}

function blankDraft(): Draft {
  const today = todayIso()
  return {
    id: null, name: '', orderDate: today,
    items: [{ productId: CALCULATOR_PRODUCTS[0]?.id ?? '', quantity: '1000', priceUsd: '' }],
    productionDays: '',
    fxRate: String(DEFAULT_CALC_CONFIG.usdEur), fxDate: today,
  }
}

function draftFrom(c: Calculation): Draft {
  const p = c.payload
  // Saves written before the rows carried a price open with an empty one, so
  // their production cost reads 0 € until it is entered — the settings-based
  // estimate the calculator used to apply is deliberately not resurrected here.
  const items: DraftItem[] = (p.items ?? Object.entries(p.quantities ?? {})
    .filter(([id, q]) => (Number(q) || 0) > 0 && CALCULATOR_PRODUCTS.some(cp => cp.id === id))
    .map(([productId, quantity]) => ({ productId, quantity, priceUsd: '' })))
    .map(it => ({ ...it, priceUsd: it.priceUsd ?? '' }))
  return {
    id: c.id, name: c.name, orderDate: p.orderDate,
    items, productionDays: p.productionDays ?? '',
    fxRate: p.fxRate ?? String(p.config?.usdEur ?? DEFAULT_CALC_CONFIG.usdEur),
    fxDate: p.fxDate ?? p.orderDate,
  }
}

const qtyMap = (items: DraftItem[]): Record<string, number> =>
  Object.fromEntries(items.filter(i => i.productId).map(i => [i.productId, Number(i.quantity) || 0]))

/** A rate is usable only when it is a finite number above zero. */
const fxOf = (v: string): number | null => {
  const n = Number(v)
  return v.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n
}

const usdTotal = (items: DraftItem[]): number =>
  items.reduce((s, it) => s + (Number(it.priceUsd) || 0), 0)

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InboundCalculatorPage() {
  const router = useRouter()

  const [config, setConfig] = useState<CalcConfig>(DEFAULT_CALC_CONFIG)
  // The stored defaults, kept apart from the working config: a saved
  // calculation carries its own copy, so changing the defaults later must not
  // rewrite it — it only gets told that they moved.
  const [defaults, setDefaults] = useState<CalcConfig>(DEFAULT_CALC_CONFIG)
  const [tiersOpen,  setTiersOpen]  = useState(false)
  const [tierDraft,  setTierDraft]  = useState<{ qty: string; days: string }[]>([])
  const [tiersSaving, setTiersSaving] = useState(false)

  // The editor sits below the list; opening a record scrolls it into view.
  const editorRef = useRef<HTMLDivElement>(null)
  const [scrollTick, setScrollTick] = useState(0)
  useEffect(() => {
    if (scrollTick > 0) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTick])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [status,  setStatus]  = useState<string | null>(null)

  const [calcs,    setCalcs]    = useState<Calculation[]>([])
  const [draft,    setDraft]    = useState<Draft>(blankDraft)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [creating, setCreating] = useState<ShipMode | null>(null)

  const { fxBusy, fxNote, fetchRate } = useFxRate()

  // Stock forecast inputs.
  const [inventory, setInventory] = useState<InventoryRow[] | null>(null)
  const [stockState, setStockState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [stockNote,  setStockNote]  = useState<string | null>(null)
  const [inbounds,  setInbounds]  = useState<Inbound[]>([])
  const [rates,     setRates]     = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/inbound-calc-config').then(r => r.json()).catch(() => null),
      fetch('/api/inbound-scenarios').then(r => r.json()).catch(() => null),
    ]).then(([cfg, scn]) => {
      if (cfg?.config) { setConfig(cfg.config); setDefaults(cfg.config) }
      if (scn?.scenarios) setCalcs(scn.scenarios)
      setLoading(false)
    })
  }, [])

  // Stock and planned arrivals feed the forecast only — the cost side of the
  // page must not wait on them, so they load on their own and fail on their own.
  useEffect(() => {
    fetch('/api/inventory')
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Could not load stock levels')
        setInventory(json.rows as InventoryRow[])
        setStockState('ready')
        if (json.sources && !json.sources.weship) {
          setStockNote('WeShip did not answer — the figures below are Shopify’s.')
        }
      })
      .catch(e => {
        setStockState('failed')
        setStockNote(e instanceof Error ? e.message : 'Could not load stock levels')
      })

    fetch('/api/inbounds')
      .then(r => r.json())
      .then(json => { if (json?.inbounds) setInbounds(json.inbounds as Inbound[]) })
      .catch(() => {})
  }, [])

  const qtyByProduct = useMemo(() => qtyMap(draft.items), [draft.items])
  const totalQty     = useMemo(
    () => Object.values(qtyByProduct).reduce((s, q) => s + q, 0),
    [qtyByProduct],
  )

  // The one rate of this calculation. It converts the production positions and,
  // through the config handed to calculateAll, the freight as well.
  const rate         = fxOf(draft.fxRate)
  const productionEur = usdToEur(usdTotal(draft.items), rate) ?? 0

  const tierDays    = productionDaysFor(totalQty, config.productionTiers)
  // Only a saved calculation can be behind the defaults — a new one starts on them.
  const tiersBehind = draft.id !== null && tierKey(config.productionTiers) !== tierKey(defaults.productionTiers)
  const prodDaysNum = draft.productionDays === '' ? tierDays : Number(draft.productionDays) || 0

  const effectiveOrderDate = draft.orderDate || todayIso()

  const results = useMemo(
    () => calculateAll({
      orderDate: effectiveOrderDate, qtyByProduct, productionDays: prodDaysNum,
      productionEur, config: { ...config, usdEur: rate ?? 0 },
    }),
    [effectiveOrderDate, qtyByProduct, prodDaysNum, productionEur, config, rate],
  )

  // Without a rate every EUR figure would silently be 0,00 € — which is not the
  // same statement as "not converted yet".
  const eur = (v: number) => (rate === null ? '—' : fmtEur(v))

  const scale     = Math.max(...results.map(r => r.totalDays.max), 1)
  const cheapest  = results.reduce((a, b) => (b.totalEur < a.totalEur ? b : a))
  const fastest   = results.reduce((a, b) => (b.totalDays.min < a.totalDays.min ? b : a))
  const todayOff  = daysBetween(effectiveOrderDate, todayIso())

  function patchDraft(p: Partial<Draft>) { setDraft(d => ({ ...d, ...p })) }

  function patchMode(mode: ShipMode, patch: Partial<CalcConfig['modes'][ShipMode]>) {
    setConfig(c => ({ ...c, modes: { ...c.modes, [mode]: { ...c.modes[mode], ...patch } } }))
  }

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }, [])

  // ─── Forecast ──────────────────────────────────────────────────────────────

  const today = todayIso()

  /** Far enough out that the slowest mode's late arrival is still on the chart. */
  const horizon = useMemo(() => {
    const last = Math.max(...results.map(r => daysBetween(today, r.readyAtWeship.max)), 0)
    return Math.max(FORECAST_MIN_DAYS, last + FORECAST_TAIL_DAYS)
  }, [results, today])

  const forecastProducts = useMemo(() => CALCULATOR_PRODUCTS.map(p => {
    const row       = inventory?.find(r => r.sku === p.forecastSku) ?? null
    const suggested = row?.avg_daily_sales ?? 0
    const typed     = rates[p.id]
    return {
      id:         p.id,
      name:       p.name,
      units:      row?.units ?? 0,
      known:      row !== null,
      suggested,
      dailySales: typed !== undefined && typed !== '' ? Math.max(0, Number(typed) || 0) : suggested,
    }
  }), [inventory, rates])

  // Everything already on the water counts: leaving planned inbounds out would
  // show a shortfall that a delivery three weeks from now already covers.
  const plannedRestocks = useMemo<Restock[]>(() => {
    const out: Restock[] = []
    for (const inb of inbounds) {
      for (const sh of inb.shipments) {
        const date = sh.actual_arrival ?? sh.planned_arrival
        if (!date) continue
        for (const si of sh.items) {
          if (si.quantity > 0 && CALCULATOR_PRODUCTS.some(p => p.id === si.product_id)) {
            out.push({ productId: si.product_id, date, quantity: si.quantity, label: inb.name })
          }
        }
      }
    }
    return out
  }, [inbounds])

  const projectionInput = useMemo(
    () => forecastProducts.map(p => ({ id: p.id, units: p.units, dailySales: p.dailySales })),
    [forecastProducts],
  )

  const baseline = useMemo(
    () => projectStock({ startIso: today, days: horizon, products: projectionInput, restocks: plannedRestocks }),
    [today, horizon, projectionInput, plannedRestocks],
  )

  const branches = useMemo<ModeBranch[]>(() => results.map(r => ({
    mode:    r.mode,
    label:   r.label,
    // The early end of the window: the question is when the goods can be there,
    // and the late end is already carried by the timeline above.
    arrival: r.readyAtWeship.min,
    result: projectStock({
      startIso: today, days: horizon, products: projectionInput,
      restocks: [
        ...plannedRestocks,
        ...Object.entries(qtyByProduct)
          .filter(([, q]) => q > 0)
          .map(([productId, quantity]) => ({ productId, date: r.readyAtWeship.min, quantity })),
      ],
    }),
  })), [results, today, horizon, projectionInput, plannedRestocks, qtyByProduct])

  // ─── Persistence ───────────────────────────────────────────────────────────

  async function save() {
    if (!draft.name.trim()) {
      setError('Give the calculation a name before saving')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: CalcPayload = {
        orderDate:      effectiveOrderDate,
        items:          draft.items.filter(i => i.productId),
        productionDays: draft.productionDays,
        fxRate:         draft.fxRate,
        fxDate:         draft.fxDate,
        config,
      }
      const res = await fetch(
        draft.id ? `/api/inbound-scenarios/${draft.id}` : '/api/inbound-scenarios',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: draft.name.trim(), payload }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save the calculation')

      if (draft.id) {
        const id = draft.id
        setCalcs(cs => cs.map(c => (c.id === id ? { ...c, name: draft.name.trim(), payload } : c)))
        flash('Calculation saved')
      } else {
        setCalcs(cs => [json.scenario, ...cs])
        // Stay in the editor on the saved record, so the next Save updates it
        // instead of filing a second copy under the same name.
        patchDraft({ id: json.scenario.id })
        flash('Calculation saved')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the calculation')
    } finally {
      setSaving(false)
    }
  }

  function edit(c: Calculation) {
    setDraft(draftFrom(c))
    if (c.payload.config) setConfig(c.payload.config)
    setScrollTick(t => t + 1)
  }

  /** A copy opens unsaved, with the original's assumptions. */
  function duplicate(c: Calculation) {
    const d = draftFrom(c)
    setDraft({ ...d, id: null, name: `${d.name} (copy)` })
    if (c.payload.config) setConfig(c.payload.config)
    setScrollTick(t => t + 1)
  }

  /** A fresh calculation starts on the stored defaults, not on whatever was last edited. */
  function startNew() {
    setDraft(blankDraft())
    setConfig(defaults)
  }

  function resetProductionToDefault() {
    patchDraft({ productionDays: '' })
    setConfig(c => ({ ...c, productionTiers: defaults.productionTiers }))
  }

  function openTiersDialog() {
    setTierDraft(defaults.productionTiers.map(t => ({ qty: String(t.qty), days: String(t.days) })))
    setTiersOpen(true)
  }

  async function saveTiers() {
    const tiers = tierDraft
      .map(t => ({ qty: Number(t.qty) || 0, days: Number(t.days) || 0 }))
      .filter(t => t.qty > 0)
      .sort((a, b) => a.qty - b.qty)
    if (tiers.length === 0) {
      setError('Add at least one tier')
      return
    }
    setTiersSaving(true)
    setError(null)
    try {
      const next = { ...defaults, productionTiers: tiers }
      const res  = await fetch('/api/inbound-calc-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save defaults')
      setDefaults(next)
      // The calculation being edited keeps its own tiers; an unsaved one has
      // nothing of its own yet and follows the new defaults.
      if (draft.id === null) setConfig(c => ({ ...c, productionTiers: tiers }))
      setTiersOpen(false)
      flash('Production defaults saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save defaults')
    } finally {
      setTiersSaving(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete calculation "${name}"?`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/inbound-scenarios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not delete')
      setCalcs(cs => cs.filter(c => c.id !== id))
      if (draft.id === id) setDraft(blankDraft())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    } finally {
      setDeleting(null)
    }
  }

  async function saveDefaults() {
    try {
      const res  = await fetch('/api/inbound-calc-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save defaults')
      setDefaults(config)
      flash('Defaults saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save defaults')
    }
  }

  async function createInbound(r: ModeResult) {
    if (!draft.name.trim()) {
      setError('Give the calculation a name before creating an inbound')
      return
    }
    setCreating(r.mode)
    setError(null)
    try {
      const picked = CALCULATOR_PRODUCTS.filter(p => qtyByProduct[p.id] > 0)

      if (picked.length === 0) throw new Error('Enter a quantity for at least one product')

      // An inbound stores USD per position plus the rate it was booked at —
      // which is exactly what was typed here, so nothing is converted back. A
      // blank rate carries over as null and the inbound editor asks for it.
      const items = picked.map(p => ({
        product_id: p.id,
        charge: '',
        quantity: qtyByProduct[p.id],
        production_cost_usd: Number(draft.items.find(i => i.productId === p.id)?.priceUsd) || 0,
        supplier_id: null,
      }))

      // The calculator plans a single leg, so the charge starts with one
      // shipment carrying everything. Splitting it across modes happens in the
      // inbound editor, where the real quotes land.
      const shipment = {
        mode: r.mode,
        shipping_company_id: null,
        cost_usd: Math.round(r.costUsd * 100) / 100,
        fx_usd_eur: rate,
        fx_date: draft.fxDate || effectiveOrderDate,
        planned_arrival: r.readyAtWeship.min,
        actual_arrival: null,
        items: picked.map(p => ({ product_id: p.id, quantity: qtyByProduct[p.id] })),
      }

      const res = await fetch('/api/inbounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          order_date: effectiveOrderDate,
          production_fx_usd_eur: rate,
          production_fx_date: draft.fxDate || effectiveOrderDate,
          notes: `Planned with the Inbound Calculator (${r.label}, ${r.totalDays.min}–${r.totalDays.max} days, `
               + `ready ${r.readyAtWeship.min} to ${r.readyAtWeship.max}).`,
          items,
          shipments: [shipment],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create inbound')
      router.push('/dashboard/inventory/inbounds')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create inbound')
    } finally {
      setCreating(null)
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8">
        <SkeletonCard lines={5} />
      </main>
    )
  }

  return (
    <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: G, fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 600, color: '#111110', margin: 0 }}>
          Inbound Calculator
        </h1>
        <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64', marginTop: 6 }}>
          Plan a future goods order: what it costs, when it is ready to ship at WeShip, and whether
          the stock on hand lasts until then.
        </p>
      </div>

      {error  && <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#DC2626', marginBottom: 16 }}>{error}</p>}
      {status && <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#0D8585', marginBottom: 16 }}>{status}</p>}

      {/* ─── Saved calculations ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader
          label="Calculations"
          action={<button style={btnLarge} onClick={startNew}>New calculation</button>}
        />

        {calcs.length === 0 ? (
          <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            No saved calculations yet. Plan one below and save it.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Name',       align: 'left'  },
                    { label: 'Order Date', align: 'left'  },
                    { label: 'Products',   align: 'left'  },
                    { label: 'Total (DDP)', align: 'right' },
                    { label: '',           align: 'right' },
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
                {calcs.map((c, i) => {
                  const d       = draftFrom(c)
                  const qty     = qtyMap(d.items)
                  const cfg     = c.payload.config ?? config
                  const tot     = Object.values(qty).reduce((s, q) => s + q, 0)
                  const rowRate = fxOf(d.fxRate)
                  const rows = calculateAll({
                    orderDate: d.orderDate || todayIso(),
                    qtyByProduct: qty,
                    productionDays: d.productionDays === ''
                      ? productionDaysFor(tot, cfg.productionTiers)
                      : Number(d.productionDays) || 0,
                    productionEur: usdToEur(usdTotal(d.items), rowRate) ?? 0,
                    config: { ...cfg, usdEur: rowRate ?? 0 },
                  })
                  const best = rows.reduce((a, b) => (b.totalEur < a.totalEur ? b : a))
                  return (
                    <tr key={c.id} style={{
                      borderBottom: i < calcs.length - 1 ? '1px solid #F0EFE9' : 'none',
                      backgroundColor: draft.id === c.id ? '#FAFAF7' : 'transparent',
                    }}>
                      <td style={{ ...td, paddingLeft: 4, paddingRight: 20, fontFamily: G, color: '#111110' }}>{c.name}</td>
                      <td style={{ ...td, paddingRight: 20, whiteSpace: 'nowrap' }}>{fmtDate(d.orderDate)}</td>
                      <td style={{ ...td, paddingRight: 20 }}>
                        {d.items.length === 0 ? '—' : d.items.map(it => (
                          <span key={it.productId} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                            <span className="metric" style={{ color: '#111110' }}>{fmtInt(Number(it.quantity) || 0)}</span>
                            <span>&nbsp;× {productName(it.productId)}</span>
                          </span>
                        ))}
                      </td>
                      <td className="metric" style={{ ...td, paddingRight: 20, textAlign: 'right', color: '#111110' }}>
                        {rowRate === null ? '—' : fmtEur(best.totalEur)}
                        <span style={{ display: 'block', fontSize: '0.6875rem', marginTop: 2 }}>
                          <ShipModeLabel mode={best.mode} label={best.label} size={12} />
                        </span>
                      </td>
                      <td style={{ ...td, paddingRight: 4, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="flex items-center justify-end gap-2">
                          <button style={btn} onClick={() => edit(c)}>Edit</button>
                          <button style={iconBtnGrey} title={`Duplicate ${c.name}`} onClick={() => duplicate(c)}>
                            <CopyIcon />
                          </button>
                          <button style={iconBtnDanger} title={`Delete ${c.name}`}
                            disabled={deleting === c.id}
                            onClick={() => remove(c.id, c.name)}>
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

      {/* ─── Order ──────────────────────────────────────────────────────── */}
      <div ref={editorRef} style={{ scrollMarginTop: 16 }}>
      <Card className="mb-4">
        <CardHeader label={draft.id ? `Edit ${draft.name || 'calculation'}` : 'New calculation'} />

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <Field label="Name">
            <input style={inp} value={draft.name} placeholder="e.g. Spring restock 2026"
              onChange={e => patchDraft({ name: e.target.value })} />
          </Field>
          <Field label="Order / payment date">
            <DatePicker value={draft.orderDate} onChange={v => patchDraft({ orderDate: v })} />
          </Field>
          <Field label="Total quantity">
            <div className="metric" style={{ ...readout, textAlign: 'right' }}>{fmtInt(totalQty)}</div>
          </Field>
        </div>

        {/* Own row: the field is short, but the two buttons beside it and the
            defaults note would not fit a grid cell. */}
        <div style={{ marginTop: 16 }}>
          <Field label="Production days">
            <div className="flex gap-2 flex-wrap items-center">
              <div style={{ width: 130 }}>
                <NumberInput min={0} step={1} integer
                  placeholder={String(tierDays)}
                  value={draft.productionDays}
                  onChange={v => patchDraft({ productionDays: v })} />
              </div>
              <button style={btn} onClick={resetProductionToDefault}
                disabled={draft.productionDays === '' && !tiersBehind}>
                Reset to default
              </button>
              <button style={btn} onClick={openTiersDialog}>Set defaults</button>
              {tiersBehind && (
                <span className="flex items-center gap-2" style={{ fontFamily: G, fontSize: '0.6875rem', color: '#EA6C00' }}>
                  <span aria-hidden style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: '1.3px solid #EA6C00', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.625rem',
                  }}>!</span>
                  The production defaults have changed since this calculation was saved — it keeps
                  its own. Reset to default to adopt them.
                </span>
              )}
            </div>
          </Field>
        </div>

        {/* ─── Products ─────────────────────────────────────────────────── */}
        <div style={{ ...frame, marginTop: SECTION_GAP }}>
          <FrameHeading>Products</FrameHeading>

          <RateRow
            date={draft.fxDate}
            rate={draft.fxRate}
            busy={fxBusy === 'calc'}
            note={fxNote['calc']}
            onDate={v => patchDraft({ fxDate: v })}
            onRate={v => patchDraft({ fxRate: v })}
            onFetch={() => fetchRate('calc', draft.fxDate,
              v => setDraft(d => ({ ...d, fxRate: v })))}
          />
          <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 6 }}>
            One rate for the whole calculation — it converts the production costs below and the
            freight in every shipping mode.
          </p>

          <div style={{ marginTop: 28 }}>
            {draft.items.length === 0 ? (
              <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98', marginBottom: 10 }}>
                No products yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                  {/* Same widths as the inbound editor, so the two tables line up. */}
                  <colgroup>
                    <col style={{ width: COL_PRODUCT }} />
                    <col style={{ width: COL_QTY }} />
                    <col style={{ width: 150 }} />
                    <col /><col />
                    <col style={{ width: 56 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        { l: 'Product',                  a: 'left'  },
                        { l: 'Quantity',                 a: 'right' },
                        { l: 'Production costs (EXW) $', a: 'right' },
                        { l: '€',                        a: 'right' },
                        { l: '€ per unit',               a: 'right' },
                        { l: '',                         a: 'right' },
                      ].map(({ l, a }, i) => (
                        <th key={i} className="label"
                          style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: 14 }}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((it, idx) => {
                      const patch = (p: Partial<DraftItem>) => setDraft(d => ({
                        ...d, items: d.items.map((x, i) => (i === idx ? { ...x, ...p } : x)),
                      }))
                      const qty     = Number(it.quantity) || 0
                      const lineEur = usdToEur(Number(it.priceUsd) || 0, rate)
                      const perUnit = lineEur !== null && qty ? lineEur / qty : null
                      return (
                        <tr key={idx}>
                          <td style={{ ...td, paddingRight: 14 }}>
                            <Select value={it.productId} onChange={v => patch({ productId: v })}>
                              <option value="">Select product…</option>
                              {CALCULATOR_PRODUCTS.map(p => (
                                <option key={p.id} value={p.id}
                                  disabled={p.id !== it.productId && draft.items.some(x => x.productId === p.id)}>
                                  {p.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td style={{ ...td, paddingRight: 14 }}>
                            <NumberInput min={0} step={1} integer placeholder="0" value={it.quantity}
                              onChange={v => patch({ quantity: v })} />
                          </td>
                          <td style={{ ...td, paddingRight: 14 }}>
                            <NumberInput min={0} step={0.01} placeholder="0.00" value={it.priceUsd}
                              onChange={v => patch({ priceUsd: v })} />
                          </td>
                          <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                            {lineEur === null ? '—' : fmtEur(lineEur)}
                          </td>
                          <td className="metric" style={{ ...td, paddingRight: 14, textAlign: 'right', whiteSpace: 'nowrap', color: '#6B6A64' }}>
                            {perUnit === null ? '—' : fmtEur(perUnit)}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <button style={iconBtnDanger} title="Remove product"
                              onClick={() => setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))}>
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
            <button style={btnAccent}
              disabled={draft.items.length >= CALCULATOR_PRODUCTS.length}
              onClick={() => setDraft(d => ({
                ...d, items: [...d.items, { productId: '', quantity: '', priceUsd: '' }],
              }))}>
              <PlusIcon /> Add product
            </button>
            <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 10 }}>
              Only the Bevi Bags can be planned here — they are the main product and the only ones
              with a stock forecast behind them. More products follow.
            </p>
          </div>
        </div>

        {/* ─── Assumptions ──────────────────────────────────────────────── */}
        <div style={{ ...frame, marginTop: SECTION_GAP }}>
          <FrameHeading>Assumptions</FrameHeading>
          {/* Fixed width: in a grid cell each field was ~80px wide for a number
              that is never more than two digits. */}
          <Field label="WeShip handling (days)">
            {/* The inputs are pinned, not the field: in a grid cell each box was
                ~80px wide for a number that is never more than two digits. The
                label stays free so it does not wrap. */}
            <div style={{ width: 150 }}>
              <RangeInput
                value={config.weshipHandling}
                onChange={v => setConfig(c => ({ ...c, weshipHandling: v }))} />
            </div>
          </Field>
          <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 12 }}>
            Production defaults to the tier covering the quantity
            ({config.productionTiers.map(t => `${fmtInt(t.qty)} pcs → ${t.days} d`).join(' · ')});
            leave the field empty to follow it, or type a value to override.
          </p>
        </div>
      </Card>
      </div>

      {/* ─── Comparison ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader
          label="Shipping modes"
          action={<button style={btn} onClick={saveDefaults}>Save as defaults</button>}
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 640 }}>
            <thead>
              <tr>
                <th className="label" style={{ textAlign: 'left', paddingBottom: 10, borderBottom: '1px solid #E3E2DC' }} />
                {/* Names on one line, tags on a line of their own beneath — a
                    tag beside the name pushed that column out of step. */}
                {results.map(r => (
                  <th key={r.mode} className="label"
                    style={{ textAlign: 'right', verticalAlign: 'top', paddingBottom: 10, paddingLeft: 20, borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.75rem' }}><ShipModeLabel mode={r.mode} label={r.label} /></span>
                    {(r.mode === cheapest.mode || r.mode === fastest.mode) && (
                      <span className="flex justify-end gap-1" style={{ marginTop: 5 }}>
                        {r.mode === cheapest.mode && <Tag>cheapest</Tag>}
                        {r.mode === fastest.mode  && <Tag>fastest</Tag>}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Pre-departure (days)">
                {results.map(r => (
                  <Cell key={r.mode}>
                    <RangeInput
                      value={config.modes[r.mode].preDeparture}
                      onChange={v => patchMode(r.mode, { preDeparture: v })} />
                  </Cell>
                ))}
              </Row>
              <Row label="Transit (days)">
                {results.map(r => (
                  <Cell key={r.mode}>
                    <RangeInput
                      value={config.modes[r.mode].transit}
                      onChange={v => patchMode(r.mode, { transit: v })} />
                  </Cell>
                ))}
              </Row>
              <Row label="Freight (USD)">
                {results.map(r => (
                  <Cell key={r.mode}>
                    <NumberInput min={0} step={1} integer
                      value={config.modes[r.mode].costUsd}
                      onChange={v => patchMode(r.mode, { costUsd: Number(v) || 0 })} />
                  </Cell>
                ))}
              </Row>
              <Row label="Freight (EUR)">
                {results.map(r => <Cell key={r.mode} metric>{eur(r.costEur)}</Cell>)}
              </Row>
              <Row label="Production (EUR)">
                {results.map(r => <Cell key={r.mode} metric>{eur(r.productionEur)}</Cell>)}
              </Row>
              <Row label="Total (EUR)" strong>
                {results.map(r => <Cell key={r.mode} metric strong>{eur(r.totalEur)}</Cell>)}
              </Row>
              <Row label="Landed cost / unit">
                {results.map(r => (
                  <Cell key={r.mode} metric>{r.landedPerUnit === null ? '—' : eur(r.landedPerUnit)}</Cell>
                ))}
              </Row>
              <Row label="Ready at WeShip" strong>
                {results.map(r => (
                  <Cell key={r.mode}>
                    <span style={{ display: 'block', color: '#111110', whiteSpace: 'nowrap' }}>{fmtDate(r.readyAtWeship.min)}</span>
                    <span style={{ display: 'block', color: '#6B6A64', whiteSpace: 'nowrap', fontWeight: 500 }}>– {fmtDate(r.readyAtWeship.max)}</span>
                  </Cell>
                ))}
              </Row>
              <Row label="Lead time (days)">
                {results.map(r => (
                  <Cell key={r.mode} metric>
                    {r.totalDays.min}–{r.totalDays.max}
                    <span style={{ color: '#9E9D98' }}> (±{r.spanDays})</span>
                  </Cell>
                ))}
              </Row>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Stock forecast ─────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Stock forecast" />

        {stockNote && (
          <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#EA6C00', marginBottom: 16 }}>{stockNote}</p>
        )}

        {stockState === 'loading' ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} />
          </div>
        ) : stockState === 'failed' ? (
          <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>
            Without the current stock levels the forecast cannot be drawn. The costs and dates above
            are unaffected.
          </p>
        ) : forecastProducts.map((p, i) => {
          const runsOut = baseline.runsOutOn[p.id] ?? null
          return (
            <div key={p.id}>
              <div style={{ ...frame, marginTop: i === 0 ? 0 : SECTION_GAP }}>
                <FrameHeading>{p.name}</FrameHeading>
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 18 }}>
                  <Field label="On stock today">
                    <div className="metric" style={{ ...readout, textAlign: 'right' }}>
                      {p.known ? fmtInt(p.units) : '—'}
                    </div>
                  </Field>
                  <Field label="Sales per day" hint={`Last 30 days: ${p.suggested.toFixed(1)}`}>
                    {/* Whole units only: the arrows step by one, and a typed
                        decimal is cut off rather than carried into the forecast. */}
                    <NumberInput min={0} step={1} integer
                      placeholder={String(Math.round(p.suggested))}
                      value={rates[p.id] ?? ''}
                      onChange={v => setRates(s => ({ ...s, [p.id]: v }))} />
                  </Field>
                  <Field label="Sold out">
                    <DateReadout>
                      {p.dailySales <= 0 ? 'not selling' : runsOut ? fmtDate(runsOut) : `after ${horizon} days`}
                    </DateReadout>
                  </Field>
                </div>

                <StockProjectionChart productId={p.id} baseline={baseline} branches={branches} restocks={plannedRestocks} />

                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', color: '#6B6A64' }}>
                    <thead>
                      <tr>
                        {[
                          { l: 'Mode',              a: 'left'  },
                          { l: 'Arrives at WeShip', a: 'left'  },
                          { l: 'Stock on arrival',  a: 'right' },
                          { l: '',                  a: 'left'  },
                        ].map(({ l, a }, k) => (
                          <th key={k} className="label"
                            style={{ ...th, textAlign: a as 'left' | 'right', paddingRight: 16 }}>{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* The baseline is a row here rather than a legend of its
                          own — this table is the chart's legend, and the black
                          line needs a name as much as the four dashed ones. */}
                      <tr style={{ borderTop: '1px solid #E7E6E0' }}>
                        <td style={{ ...td, paddingRight: 16 }}>
                          <span className="flex items-center gap-2" style={{ color: '#111110' }}>
                            <Dash color="#111110" />
                            No new order
                          </span>
                        </td>
                        <td style={{ ...td, paddingRight: 16 }}>—</td>
                        <td style={{ ...td, paddingRight: 16, textAlign: 'right' }}>—</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {p.dailySales <= 0
                            ? <span style={{ color: '#9E9D98' }}>no sales rate</span>
                            : runsOut
                              ? <span style={{ color: '#DC2626' }}>sold out {fmtDate(runsOut)}</span>
                              : <span style={{ color: '#0D8585' }}>lasts past the window</span>}
                        </td>
                      </tr>
                      {branches.map(b => {
                        const left = unitsOn(baseline, p.id, b.arrival)
                        // The gap is what the order is actually about: days with
                        // an empty shelf before this mode's goods land.
                        const gap  = runsOut && runsOut <= b.arrival ? daysBetween(runsOut, b.arrival) : 0
                        return (
                          <tr key={b.mode} style={{ borderTop: '1px solid #E7E6E0' }}>
                            <td style={{ ...td, paddingRight: 16 }}>
                              <span className="flex items-center gap-2" style={{ color: '#111110' }}>
                                <Dash color={modeColor(b.mode)} dashed />
                                <ShipModeLabel mode={b.mode} label={b.label} />
                              </span>
                            </td>
                            <td style={{ ...td, paddingRight: 16, whiteSpace: 'nowrap' }}>{fmtDate(b.arrival)}</td>
                            <td className="metric" style={{ ...td, paddingRight: 16, textAlign: 'right', color: '#111110' }}>
                              {left === null ? '—' : fmtInt(left)}
                            </td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                              {p.dailySales <= 0
                                ? <span style={{ color: '#9E9D98' }}>no sales rate</span>
                                : gap > 0
                                  ? <span style={{ color: '#DC2626' }}>{gap} days out of stock</span>
                                  : <span style={{ color: '#0D8585' }}>in time</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}

        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 16 }}>
          <b style={{ fontWeight: 500 }}>Stock on arrival</b> is what is still on the shelf on the day
          that mode’s goods reach WeShip, <i>if this order is not placed</i> — the black line on that
          day. Stock itself is WeShip’s on-hand minus what is already going out, and the line falls at
          the sales rate of the last 30 days. That rate only counts orders that carry the SKU — bags
          sold inside a bundle are not attributed to them, so it reads low; override it above.
          Inbounds already planned are included in the falling line.
        </p>
      </Card>

      {/* ─── Timeline ───────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Timeline" />
        <div className="flex gap-4 flex-wrap mb-5">
          {PHASE_LABEL.map(([key, label]) => (
            <span key={key} className="flex items-center gap-2" style={{ fontFamily: G, fontSize: '0.6875rem', color: '#6B6A64' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PHASE_COLOR[key], display: 'inline-block' }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-2" style={{ fontFamily: G, fontSize: '0.6875rem', color: '#6B6A64' }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3, display: 'inline-block',
              backgroundImage: 'repeating-linear-gradient(45deg, #C9C8C2 0 3px, transparent 3px 6px)',
              border: '1px solid #E3E2DC',
            }} />
            Uncertainty
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {results.map(r => (
            <div key={r.mode}>
              <div className="flex items-baseline justify-between mb-1.5" style={{ fontFamily: G, fontSize: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}><ShipModeLabel mode={r.mode} label={r.label} /></span>
                <span className="metric" style={{ color: '#6B6A64' }}>
                  {fmtDate(r.readyAtWeship.min)} – {fmtDate(r.readyAtWeship.max)}
                </span>
              </div>
              <div style={{ position: 'relative', height: 18, backgroundColor: '#F5F4F0', borderRadius: 5, overflow: 'hidden' }}>
                {r.phases.map(p => (
                  <div
                    key={p.key}
                    title={`${p.label}: ${p.days.min === p.days.max ? `${p.days.min}` : `${p.days.min}–${p.days.max}`} days`}
                    style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left:  `${(p.startMin / scale) * 100}%`,
                      width: `${((p.endMin - p.startMin) / scale) * 100}%`,
                      backgroundColor: PHASE_COLOR[p.key],
                    }}
                  />
                ))}
                {/* Accumulated slack across all phases, drawn at the end. */}
                {r.spanDays > 0 && (
                  <div
                    title={`Up to ${r.spanDays} days later`}
                    style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left:  `${(r.totalDays.min / scale) * 100}%`,
                      width: `${(r.spanDays / scale) * 100}%`,
                      backgroundImage: 'repeating-linear-gradient(45deg, #C9C8C2 0 4px, transparent 4px 8px)',
                    }}
                  />
                )}
                {todayOff > 0 && todayOff < scale && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${(todayOff / scale) * 100}%`,
                    width: 2, backgroundColor: '#DC2626',
                  }} title={`Today — ${fmtDate(todayIso())}`} />
                )}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 14 }}>
          Calendar days from {fmtDate(effectiveOrderDate)}. Chinese New Year and other factory shutdowns are
          not modelled — add them to the production days when they fall inside the window.
        </p>
      </Card>

      {/* ─── Save & handover ────────────────────────────────────────────── */}
      <Card>
        <CardHeader label="Create as inbound" />
        <div className="flex gap-2 flex-wrap items-center">
          {results.map(r => (
            <button key={r.mode} style={{ ...btn, opacity: creating !== null ? 0.6 : 1 }}
              disabled={creating !== null}
              onClick={() => createInbound(r)}>
              <span style={{ color: modeColor(r.mode), display: 'inline-flex' }}><ShipModeIcon mode={r.mode} /></span>
              {creating === r.mode ? 'Creating…' : r.label}
            </button>
          ))}
        </div>
        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 10 }}>
          Creates an inbound named after this calculation, with its quantities, costs and the planned
          WeShip window of the chosen mode.
        </p>
      </Card>

      <div className="flex gap-2" style={{ marginTop: 20 }}>
        <button style={btnLarge} disabled={saving || !draft.name.trim()} onClick={save}>
          {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Save calculation'}
        </button>
        {draft.id && (
          <button style={btnLargeSecondary} onClick={startNew}>Cancel</button>
        )}
      </div>

      {/* ─── Production defaults ────────────────────────────────────────── */}
      <Modal
        open={tiersOpen}
        title="Production defaults"
        width={420}
        onClose={() => setTiersOpen(false)}
        footer={
          <>
            <button style={btnLargeSecondary} onClick={() => setTiersOpen(false)}>Cancel</button>
            <button style={btnLarge} disabled={tiersSaving} onClick={saveTiers}>
              {tiersSaving ? 'Saving…' : 'Save defaults'}
            </button>
          </>
        }
      >
        <p style={{ fontFamily: G, fontSize: '0.75rem', color: '#6B6A64', margin: '0 0 14px' }}>
          Production days by order size. A quantity takes the first tier that still covers it;
          above the largest tier, the largest tier&apos;s days apply. Saved for every calculation —
          ones already saved keep their own figures and are only told the defaults moved.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th className="label" style={{ ...th, textAlign: 'right', paddingRight: 14 }}>Up to (pcs)</th>
              <th className="label" style={{ ...th, textAlign: 'right', paddingRight: 14 }}>Days</th>
              <th style={{ ...th, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {tierDraft.map((t, i) => (
              <tr key={i}>
                <td style={{ ...td, padding: '8px 14px 8px 0' }}>
                  <NumberInput min={0} step={100} integer placeholder="0" value={t.qty}
                    onChange={v => setTierDraft(rows => rows.map((r, k) => (k === i ? { ...r, qty: v } : r)))} />
                </td>
                <td style={{ ...td, padding: '8px 14px 8px 0' }}>
                  <NumberInput min={0} step={1} integer placeholder="0" value={t.days}
                    onChange={v => setTierDraft(rows => rows.map((r, k) => (k === i ? { ...r, days: v } : r)))} />
                </td>
                <td style={{ ...td, padding: '8px 0', textAlign: 'right' }}>
                  <button style={iconBtnDanger} title="Remove tier"
                    onClick={() => setTierDraft(rows => rows.filter((_, k) => k !== i))}>
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button style={{ ...btnAccent, marginTop: 10 }}
          onClick={() => setTierDraft(rows => [...rows, { qty: '', days: '' }])}>
          <PlusIcon /> Add tier
        </button>
      </Modal>
    </main>
  )
}

/** Order-insensitive fingerprint of a tier list, for "have the defaults moved". */
function tierKey(tiers: CalcConfig['productionTiers']): string {
  return [...tiers].sort((a, b) => a.qty - b.qty).map(t => `${t.qty}:${t.days}`).join('|')
}

// ─── Small building blocks ───────────────────────────────────────────────────

// Every cell needs an explicit colour: the app's inherited default is set on
// <body> and .metric styles numerals only, so an unstyled cell renders invisibly
// against the white card.
const th: React.CSSProperties = { paddingBottom: 10, borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '12px 0', verticalAlign: 'top', color: '#6B6A64' }

// Filled panel, matching the inbound editor's sections.
const frame: React.CSSProperties = {
  backgroundColor: '#F5F4F0', borderRadius: 12, padding: '16px 18px',
}

/**
 * Heading of a filled area, sitting inside it. Same pattern as the shipment
 * blocks in the inbound editor: outside the frame the label floated above the
 * surface it names.
 */
function FrameHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
      <span className="label">{children}</span>
    </div>
  )
}

/** A piece of the line it stands for, so the table reads as the chart's legend. */
function Dash({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span style={{
      width: 14, height: 0, display: 'inline-block', flexShrink: 0,
      borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
    }} />
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 999,
      backgroundColor: '#EDECEA', color: '#6B6A64',
      fontSize: '0.5625rem', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2,
    }}>
      {children}
    </span>
  )
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid #F0EFE9' }}>
      <td className="label" style={{
        padding: '10px 0', whiteSpace: 'nowrap',
        color: strong ? '#111110' : undefined, fontWeight: strong ? 700 : undefined,
      }}>
        {label}
      </td>
      {children}
    </tr>
  )
}

function Cell({ children, metric, strong }: { children: React.ReactNode; metric?: boolean; strong?: boolean }) {
  return (
    <td
      className={metric ? 'metric' : undefined}
      style={{
        padding: '10px 0 10px 20px', textAlign: 'right', verticalAlign: 'middle',
        color: strong ? '#111110' : '#6B6A64', width: 150,
        fontWeight: strong ? 700 : undefined,
      }}
    >
      {children}
    </td>
  )
}

/**
 * A min–max pair. The two fields alone were indistinguishable — which one was
 * the low end was left to the reader — so each carries its own caption.
 */
function RangeInput({
  value, onChange,
}: {
  value: { min: number; max: number }
  onChange: (v: { min: number; max: number }) => void
}) {
  return (
    <div className="flex gap-1">
      {(['min', 'max'] as const).map(k => (
        <div key={k} style={{ flex: 1 }}>
          <NumberInput min={0} step={1} integer style={{ paddingLeft: 6 }}
            value={value[k]} onChange={v => onChange({ ...value, [k]: Number(v) || 0 })} />
          <span style={{
            display: 'block', fontFamily: G, fontSize: '0.625rem', color: '#9E9D98',
            textAlign: 'center', marginTop: 3, letterSpacing: '0.04em',
          }}>
            {k}
          </span>
        </div>
      ))}
    </div>
  )
}
