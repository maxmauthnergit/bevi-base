import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  /** Remove default padding */
  noPadding?: boolean
}

export function Card({ children, className, noPadding = false }: CardProps) {
  return (
    <div
      className={clsx(
        'border',
        !noPadding && 'p-5',
        className,
      )}
      style={{
        backgroundColor: '#141414',
        borderColor: '#222222',
        borderRadius: '4px',
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
    <div className="flex items-center justify-between mb-4">
      <span className="label">{label}</span>
      {action}
    </div>
  )
}
