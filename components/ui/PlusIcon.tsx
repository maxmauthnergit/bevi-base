// The "+" of every add/upload button. An SVG rather than the character so its
// stroke matches TrashIcon and the mode icons — a typed "+" comes out thinner
// and sits lower than the label beside it.

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
      <path d="M6 1.5V10.5M1.5 6H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
