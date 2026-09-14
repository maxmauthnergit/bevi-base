// Row-removal icon, shared by the inbounds editor and the calculator so the two
// tables cannot drift apart. Inherits its colour from the button around it.

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 3.5 H11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 3.5 V2.4 H8.5 V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3.6 3.5 L4.2 11.4 H9.8 L10.4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 5.6 V9.4 M8 5.6 V9.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}
