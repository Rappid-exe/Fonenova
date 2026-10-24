import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuayPilot · Fone Nova',
  description: 'Internal gross profit dashboard for Fone Nova Ltd.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#111b2b', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  )
}
