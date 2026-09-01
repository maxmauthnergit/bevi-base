import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bevi Base',
  description: 'Internal dashboard — Bevi Bag GmbH',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      {/* The dark background avoids a light flash before the login page paints
          its own surface. The text colour must stay dark: this inline style
          beats the `body` rule in globals.css, so a white value here becomes the
          inherited default for the whole app and renders any element that
          forgets an explicit colour invisible inside the white cards. */}
      <body className="h-full" style={{ backgroundColor: '#0A0A0A', color: '#111110' }}>
        {children}
      </body>
    </html>
  )
}
