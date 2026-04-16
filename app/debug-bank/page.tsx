'use client'

import { useState, useRef } from 'react'

export default function DebugBankPage() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setLoading(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', f)
    const r = await fetch('/api/bank-transactions/debug', { method: 'POST', body: fd })
    const json = await r.json()
    setResult(JSON.stringify(json, null, 2))
    setLoading(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <main style={{ padding: 32, fontFamily: 'monospace', maxWidth: 1000 }}>
      <h2 style={{ marginBottom: 16 }}>Bank Parser Debug</h2>
      <input ref={ref} type="file" accept=".pdf" onChange={handleFile} />
      {loading && <p>Parsing…</p>}
      {result && (
        <pre style={{ marginTop: 20, background: '#f5f4f0', padding: 16, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #e3e2dc', borderRadius: 8 }}>
          {result}
        </pre>
      )}
    </main>
  )
}
