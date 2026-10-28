import { clsx } from 'clsx'
import { HEADING_ROW_H, SECTION_GAP } from '@/components/ui/formStyles'

interface CardProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function Card({ children, className, noPadding = false }: CardProps) {
  return (
    <div
      className={clsx(!noPadding && 'p-6', className)}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E3E2DC',
        borderRadius: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  label: string
  action?: React.ReactNode
}

export function CardHeader({ label, action }: CardHeaderProps) {
  return (
    // The row is pinned to HEADING_ROW_H: without it an action button makes the
    // row taller and pushes the label down, so a card with a button in its
    // header sat lower than one without.
    <div
      className="flex items-center justify-between flex-wrap gap-y-2"
      style={{ minHeight: HEADING_ROW_H, marginBottom: SECTION_GAP }}
    >
      <span className="label">{label}</span>
      {action}
    </div>
  )
}
