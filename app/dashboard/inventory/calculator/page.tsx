'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { G, inp, btn, btnPrimary, btnDanger, fmtEur, fmtInt } from '@/components/ui/formStyles'
import { DEFAULT_PRODUCT_COSTS, type ProductCostConfig } from '@/lib/costs-config'
import { INBOUND_PRODUCTS, type ShipMode } from '@/lib/inbounds'
import {
  DEFAULT_CALC_CONFIG, calculateAll, productionDaysFor, productionCostByProduct,
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

interface Scenario { id: string; name: string; payload: ScenarioPayload; created_at: string }

interface ScenarioPayload {
  orderDate:      string
  quantities:     Record<string, string>
  productionDays: string
  config:         CalcConfig
}

export default function InboundCalculatorPage() {
  const router = useRouter()

  const [config, setConfig] = useState<CalcConfig>(DEFAULT_CALC_CONFIG)
  const [costs,  setCosts]  = useState<ProductCostConfig[]>(DEFAULT_PRODUCT_COSTS)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [status,  setStatus]  = useState<string | null>(null)

  const [orderDate,  setOrderDate]  = useState(todayIso())
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(INBOUND_PRODUCTS.map(p => [p.id, p.id === 'bevi-bag' ? '1000' : ''])),
  )
  // Empty means "follow the tier for this quantity".
  const [productionDays, setProductionDays] = useState('')

  const [scenarios,    setScenarios]    = useState<Scenario[]>([])
  const [scenarioName, setScenarioName]  = useState('')
  const [inboundName,  setInboundName]   = useState('')
  const [creating,     setCreating]      = useState<ShipMode | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/inbound-calc-config').then(r => r.json()).catch(() => null),
      fetch('/api/costs-config').then(r => r.json()).catch(() => null),
      fetch('/api/inbound-scenarios').then(r => r.json()).catch(() => null),
    ]).then(([cfg, cst, scn]) => {
      if (cfg?.config) setConfig(cfg.config)
      if (cst?.costs)  setCosts(cst.costs)
      if (scn?.scenarios) setScenarios(scn.scenarios)
      setLoading(false)
    })
  }, [])

  const qtyByProduct = useMemo(
    () => Object.fromEntries(INBOUND_PRODUCTS.map(p => [p.id, Number(quantities[p.id]) || 0])),
    [quantities],
  )
  const totalQty = useMemo(
    () => Object.values(qtyByProduct).reduce((s, q) => s + q, 0),
    [qtyByProduct],
  )

  const tierDays    = productionDaysFor(totalQty, config.productionTiers)
  const prodDaysNum = productionDays === '' ? tierDays : Number(productionDays) || 0

  // Clearing the date input yields '', which the date maths cannot parse.
  const effectiveOrderDate = orderDate || todayIso()

  const results = useMemo(
    () => calculateAll({ orderDate: effectiveOrderDate, qtyByProduct, productionDays: prodDaysNum, config, costs }),
    [effectiveOrderDate, qtyByProduct, prodDaysNum, config, costs],
  )

  const scale     = Math.max(...results.map(r => r.totalDays.max), 1)
  const cheapest  = results.reduce((a, b) => (b.totalEur < a.totalEur ? b : a))
  const fastest   = results.reduce((a, b) => (b.totalDays.min < a.totalDays.min ? b : a))
  const todayOff  = daysBetween(effectiveOrderDate, todayIso())

  function patchMode(mode: ShipMode, patch: Partial<CalcConfig['modes'][ShipMode]>) {
    setConfig(c => ({ ...c, modes: { ...c.modes, [mode]: { ...c.modes[mode], ...patch } } }))
  }

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }, [])

  async function saveDefaults() {
    try {
      const res  = await fetch('/api/inbound-calc-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save defaults')
      flash('Defaults saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save defaults')
    }
  }

  async function saveScenario() {
    if (!scenarioName.trim()) return
    try {
      const payload: ScenarioPayload = { orderDate: effectiveOrderDate, quantities, productionDays, config }
      const res  = await fetch('/api/inbound-scenarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scenarioName, payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save scenario')
      setScenarios(s => [json.scenario, ...s])
      setScenarioName('')
      flash('Scenario saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save scenario')
    }
  }

  function loadScenario(id: string) {
    const s = scenarios.find(x => x.id === id)
    if (!s) return
    setOrderDate(s.payload.orderDate)
    setQuantities(s.payload.quantities)
    setProductionDays(s.payload.productionDays)
    setConfig(s.payload.config)
    flash(`Loaded "${s.name}"`)
  }

  async function deleteScenario(id: string) {
    try {
      const res = await fetch(`/api/inbound-scenarios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not delete scenario')
      setScenarios(s => s.filter(x => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete scenario')
    }
  }

  async function createInbound(r: ModeResult) {
    if (!inboundName.trim()) {
      setError('Enter a name before creating an inbound')
      return
    }
    setCreating(r.mode)
    setError(null)
    try {
      const prodByProduct = productionCostByProduct(costs, qtyByProduct)
      const picked = INBOUND_PRODUCTS.filter(p => qtyByProduct[p.id] > 0)

      if (picked.length === 0) throw new Error('Enter a quantity for at least one product')

      // Inbounds record what was invoiced in USD plus the rate used, so the
      // calculator hands over its own rate rather than only the converted sum.
      const rate = config.usdEur
      const items = picked.map(p => ({
        product_id: p.id,
        charge: '',
        quantity: qtyByProduct[p.id],
        production_cost_usd: rate
          ? Math.round(((prodByProduct[p.id] ?? 0) / rate) * 100) / 100
          : 0,
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
        fx_date: effectiveOrderDate,
        planned_arrival: r.readyAtWeship.min,
        actual_arrival: null,
        items: picked.map(p => ({ product_id: p.id, quantity: qtyByProduct[p.id] })),
      }

      const res = await fetch('/api/inbounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inboundName,
          order_date: effectiveOrderDate,
          production_fx_usd_eur: rate,
          production_fx_date: effectiveOrderDate,
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
      <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
        <SkeletonCard lines={5} />
      </main>
    )
  }

  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: G, fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 600, color: '#111110', margin: 0 }}>
          Inbound Calculator
        </h1>
        <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64', marginTop: 6 }}>
          Plan a future goods order: what it costs, and when it is ready to ship at WeShip.
        </p>
      </div>

      {error  && <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#DC2626', marginBottom: 16 }}>{error}</p>}
      {status && <p style={{ fontFamily: G, fontSize: '0.8125rem', color: '#0D8585', marginBottom: 16 }}>{status}</p>}

      {/* ─── Inputs ─────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader label="Order" />
        <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Field label="Order / payment date">
            <input style={inp} type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </Field>
          {INBOUND_PRODUCTS.map(p => (
            <Field key={p.id} label={p.name}>
              <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
                placeholder="0"
                value={quantities[p.id] ?? ''}
                onChange={e => setQuantities(q => ({ ...q, [p.id]: e.target.value }))} />
            </Field>
          ))}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Field label="Total quantity">
            <div className="metric" style={{ ...inp, backgroundColor: '#FAFAF7', color: '#6B6A64' }}>{fmtInt(totalQty)}</div>
          </Field>
          <Field label="Production days">
            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
              placeholder={String(tierDays)}
              value={productionDays}
              onChange={e => setProductionDays(e.target.value)} />
          </Field>
          <Field label="USD → EUR rate">
            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="0.0001"
              value={config.usdEur}
              onChange={e => setConfig(c => ({ ...c, usdEur: Number(e.target.value) || 0 }))} />
          </Field>
          <Field label="WeShip handling (days)">
            <div className="flex gap-2">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" value={config.weshipHandling.min}
                onChange={e => setConfig(c => ({ ...c, weshipHandling: { ...c.weshipHandling, min: Number(e.target.value) || 0 } }))} />
              <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" value={config.weshipHandling.max}
                onChange={e => setConfig(c => ({ ...c, weshipHandling: { ...c.weshipHandling, max: Number(e.target.value) || 0 } }))} />
            </div>
          </Field>
        </div>

        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 12 }}>
          Production defaults to the tier covering the quantity
          ({config.productionTiers.map(t => `${fmtInt(t.qty)} pcs → ${t.days} d`).join(' · ')});
          leave the field empty to follow it, or type a value to override.
        </p>
      </Card>

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
                {results.map(r => (
                  <th key={r.mode} className="label"
                    style={{ textAlign: 'right', paddingBottom: 10, paddingLeft: 20, borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#111110', fontSize: '0.75rem' }}>{r.label}</span>
                    {r.mode === cheapest.mode && <Tag>cheapest</Tag>}
                    {r.mode === fastest.mode  && <Tag>fastest</Tag>}
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
                    <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1"
                      value={config.modes[r.mode].costUsd}
                      onChange={e => patchMode(r.mode, { costUsd: Number(e.target.value) || 0 })} />
                  </Cell>
                ))}
              </Row>
              <Row label="Freight (EUR)">
                {results.map(r => <Cell key={r.mode} metric>{fmtEur(r.costEur)}</Cell>)}
              </Row>
              <Row label="Production (EUR)">
                {results.map(r => <Cell key={r.mode} metric>{fmtEur(r.productionEur)}</Cell>)}
              </Row>
              <Row label="Total (EUR)" strong>
                {results.map(r => <Cell key={r.mode} metric strong>{fmtEur(r.totalEur)}</Cell>)}
              </Row>
              <Row label="Landed cost / unit">
                {results.map(r => (
                  <Cell key={r.mode} metric>{r.landedPerUnit === null ? '—' : fmtEur(r.landedPerUnit)}</Cell>
                ))}
              </Row>
              <Row label="Ready at WeShip" strong>
                {results.map(r => (
                  <Cell key={r.mode}>
                    <span style={{ display: 'block', color: '#111110', whiteSpace: 'nowrap' }}>{fmtDate(r.readyAtWeship.min)}</span>
                    <span style={{ display: 'block', color: '#6B6A64', whiteSpace: 'nowrap' }}>– {fmtDate(r.readyAtWeship.max)}</span>
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
                <span style={{ color: '#111110', fontWeight: 500 }}>{r.label}</span>
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

      {/* ─── Scenarios & handover ───────────────────────────────────────── */}
      <Card>
        <CardHeader label="Scenarios" />
        <div className="flex gap-2 flex-wrap items-end mb-5">
          <div style={{ width: 200 }}>
            <Field label="Scenario name">
              <input style={inp} value={scenarioName} onChange={e => setScenarioName(e.target.value)}
                placeholder="e.g. Spring restock 5000" />
            </Field>
          </div>
          <button style={btn} onClick={saveScenario} disabled={!scenarioName.trim()}>Save scenario</button>
        </div>

        {scenarios.length > 0 && (
          <div className="flex flex-col gap-1 mb-6">
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center gap-2" style={{ fontFamily: G, fontSize: '0.8125rem' }}>
                <span style={{ color: '#111110', minWidth: 180 }}>{s.name}</span>
                <span style={{ color: '#9E9D98', fontSize: '0.6875rem' }}>{fmtDate(s.created_at.slice(0, 10))}</span>
                <button style={btn} onClick={() => loadScenario(s.id)}>Load</button>
                <button style={btnDanger} onClick={() => deleteScenario(s.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        <p className="label" style={{ marginBottom: 10 }}>Create as inbound</p>
        <div className="flex gap-2 flex-wrap items-end">
          <div style={{ width: 200 }}>
            <Field label="Name">
              <input style={inp} value={inboundName} onChange={e => setInboundName(e.target.value)}
                placeholder="e.g. Spring restock 2026" />
            </Field>
          </div>
          {results.map(r => (
            <button key={r.mode} style={r.mode === cheapest.mode ? btnPrimary : btn}
              disabled={creating !== null}
              onClick={() => createInbound(r)}>
              {creating === r.mode ? 'Creating…' : r.label}
            </button>
          ))}
        </div>
        <p style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 10 }}>
          Creates an inbound with the quantities, costs and the planned WeShip window of the chosen mode.
        </p>
      </Card>
    </main>
  )
}

// ─── Small building blocks ───────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 999,
      backgroundColor: 'rgba(125,239,239,0.3)', color: '#0D8585',
      fontSize: '0.5625rem', letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid #F0EFE9' }}>
      <td className="label" style={{ padding: '10px 0', whiteSpace: 'nowrap', color: strong ? '#6B6A64' : undefined }}>
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
      }}
    >
      {children}
    </td>
  )
}

function RangeInput({
  value, onChange,
}: {
  value: { min: number; max: number }
  onChange: (v: { min: number; max: number }) => void
}) {
  return (
    <div className="flex gap-1">
      <input style={{ ...inp, textAlign: 'right', padding: '4px 6px' }} type="number" min="0"
        value={value.min} onChange={e => onChange({ ...value, min: Number(e.target.value) || 0 })} />
      <input style={{ ...inp, textAlign: 'right', padding: '4px 6px' }} type="number" min="0"
        value={value.max} onChange={e => onChange({ ...value, max: Number(e.target.value) || 0 })} />
    </div>
  )
}
