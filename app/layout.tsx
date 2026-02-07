import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SDS Knowledge Base',
  description: 'Design system documentation with schema management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}