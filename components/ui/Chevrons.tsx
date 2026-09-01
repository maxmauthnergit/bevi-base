// Shared chevrons for the date controls. Sized to sit inside NAV_BTN and the
// picker triggers; they inherit their colour from the parent.

export function ChevLeft() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
      <path d="M4.5 0.5L0.5 4.5L4.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevRight() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
      <path d="M0.5 0.5L4.5 4.5L0.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevDown() {
  return (
    <svg width="9" height="5" viewBox="0 0 9 5" fill="none">
      <path d="M0.5 0.5L4.5 4.5L8.5 0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
