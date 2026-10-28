'use client'

import { useEffect, useRef } from 'react'
import { G } from '@/components/ui/formStyles'

/**
 * Centred dialog in the app's card style. Escape and a click on the backdrop
 * close it; focus moves to the first field so it can be typed into straight
 * away, and returns to whatever was focused before on close.
 */
export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  width = 380,
}: {
  title:    string
  open:     boolean
  onClose:  () => void
  children: React.ReactNode
  footer?:  React.ReactNode
  width?:   number
}) {
  const panelRef   = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // The page behind must not scroll while the dialog is up.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E3E2DC',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: 24,
          fontFamily: G,
        }}
      >
        <p style={{
          fontFamily: G, fontSize: '0.9375rem', fontWeight: 600,
          color: '#111110', margin: 0, marginBottom: 16,
        }}>
          {title}
        </p>

        {children}

        {footer && (
          <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
