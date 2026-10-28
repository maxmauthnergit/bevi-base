'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NAV, resolveActive } from '@/components/nav/nav-config'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const tabLabel: React.CSSProperties = {
  fontFamily: G,
  fontSize: '0.4375rem',
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  lineHeight: 1,
}

const tabBase: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  padding: '9px 2px',
  textDecoration: 'none',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
}

export function BottomNav() {
  const pathname = usePathname()
  const active   = resolveActive(pathname)

  // Groups can't fit their children in a 5-slot bar, so tapping one opens a
  // sheet above it instead of navigating. Every link dismisses it on the way out.
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const sheet = openGroup
    ? NAV.find(n => n.kind === 'group' && n.id === openGroup)
    : undefined

  return (
    <>
      {/* Backdrop — tap anywhere to dismiss */}
      {sheet && (
        <div
          onClick={() => setOpenGroup(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 49, backgroundColor: 'rgba(0,0,0,0.35)' }}
        />
      )}

      {/* Sub-menu sheet */}
      {sheet && sheet.kind === 'group' && (
        <div
          style={{
            position: 'fixed', left: 8, right: 8, zIndex: 51,
            bottom: 'calc(env(safe-area-inset-bottom) + 60px)',
            backgroundColor: '#111110',
            border: '1px solid #1E1E1C',
            borderRadius: 16,
            padding: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <p className="label" style={{ color: '#3A3A38', padding: '6px 12px 4px' }}>{sheet.label}</p>
          {sheet.children.map(child => {
            const isActive = active.href === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setOpenGroup(null)}
                style={{
                  display: 'block',
                  padding: '11px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#1E1E1C' : 'transparent',
                  fontFamily: G,
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#FFFFFF' : '#8A8985',
                }}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      )}

      <nav
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          backgroundColor: '#111110',
          borderTop: '1px solid #1E1E1C',
          display: 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {NAV.map(node => {
          const isActive = node.kind === 'link'
            ? active.href === node.href
            : active.groupId === node.id
          const highlighted = isActive || (node.kind === 'group' && openGroup === node.id)
          const label = (node.shortLabel ?? node.label).toUpperCase()

          const inner = (
            <>
              <span style={{
                color: highlighted ? '#7DEFEF' : '#555550',
                width: 16, height: 16, display: 'flex', flexShrink: 0,
              }}>
                {node.icon}
              </span>
              <span style={{ ...tabLabel, color: highlighted ? '#FFFFFF' : '#555550' }}>
                {label}
              </span>
            </>
          )

          if (node.kind === 'link') {
            return (
              <Link key={node.href} href={node.href} onClick={() => setOpenGroup(null)} style={tabBase}>
                {inner}
              </Link>
            )
          }

          return (
            <button
              key={node.id}
              type="button"
              aria-expanded={openGroup === node.id}
              onClick={() => setOpenGroup(g => (g === node.id ? null : node.id))}
              style={tabBase}
            >
              {inner}
            </button>
          )
        })}
      </nav>
    </>
  )
}
