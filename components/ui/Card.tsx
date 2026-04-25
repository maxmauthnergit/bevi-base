import { clsx } from 'clsx'

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
    <div className="flex items-center justify-between flex-wrap gap-y-2 mb-8">
      <span className="label">{label}</span>
      {action}
    </div>
  )
}
