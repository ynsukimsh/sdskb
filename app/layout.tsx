import './globals.css'
import type { Metadata } from 'next'
import TopBar from '@/components/TopBar'
import Sidebar from '@/components/Sidbar'
import { getContentNav } from '@/lib/content-nav'

export const metadata: Metadata = {
  title: 'SDS Knowledge Base',
  description: 'Design system documentation with schema management',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nav = getContentNav()
  return (
    <html lang="en">
      <body className="h-screen flex flex-col">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar nav={nav} />
          <main className="flex-1 overflow-auto p-8 bg-yellow-200">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}