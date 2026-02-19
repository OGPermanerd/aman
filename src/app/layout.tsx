import type { Metadata } from 'next'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import Link from 'next/link'
import './globals.css'
import { getGlobalQuarters } from '@/lib/data'
import { QuarterPicker } from './_components/quarter-picker'

export const metadata: Metadata = {
  title: 'HedgeLens',
  description: 'Track how strategy-grouped hedge funds change their portfolios between quarters',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const quarters = getGlobalQuarters()

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <NuqsAdapter>
          <nav className="border-b">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link href="/" className="text-xl font-bold tracking-tight">
                HedgeLens
              </Link>
              <QuarterPicker quarters={quarters} />
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </NuqsAdapter>
      </body>
    </html>
  )
}
