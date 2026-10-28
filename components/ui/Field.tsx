import { G } from '@/components/ui/formStyles'

/**
 * Label above a form control. Shared so the gap below the label is one number
 * for the whole app rather than a value re-typed on every page.
 */
export function Field({
  label,
  children,
  hint,
}: {
  label:     string
  children:  React.ReactNode
  hint?:     string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="label" style={{ display: 'block', marginBottom: 8 }}>{label}</span>
      {children}
      {hint && (
        <span style={{
          display: 'block', fontFamily: G, fontSize: '0.6875rem',
          color: '#9E9D98', marginTop: 5,
        }}>
          {hint}
        </span>
      )}
    </label>
  )
}
