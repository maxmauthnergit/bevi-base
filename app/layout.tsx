import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bevi Mission Control',
  description: 'Internal dashboard — Bevi Bag GmbH',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full" style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF' }}>
        {children}
      </body>
    </html>
  )
}
