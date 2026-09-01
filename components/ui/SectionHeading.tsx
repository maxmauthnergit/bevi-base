import { HEADING_ROW_H, SECTION_GAP } from '@/components/ui/formStyles'

/**
 * Heading for a block inside a card. Uses the same rhythm as CardHeader — which
 * sets 32px below its label — so "Production" and "Invoices" sit like "Inbounds"
 * and "Edit …" rather than being crammed against their content.
 *
 * The spacing above lives here too, so it is one number rather than a margin
 * retyped at every call site.
 */
export function SectionHeading({
  children,
  action,
  first = false,
}: {
  children: React.ReactNode
  action?:  React.ReactNode
  /** Set on the first section in a card, which needs no gap above it. */
  first?:   boolean
}) {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-y-2"
      style={{
        minHeight: HEADING_ROW_H,
        marginTop: first ? 0 : SECTION_GAP,
        marginBottom: SECTION_GAP,
      }}
    >
      <span className="label">{children}</span>
      {action}
    </div>
  )
}
