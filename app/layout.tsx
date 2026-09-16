import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

const title = 'Fonenova - Wholesale Mobile Phones & Consumer Tech'
const description =
  'Your trusted partner for wholesale mobile phones, tablets, laptops, and consumer electronics. Competitive pricing, bulk orders, and fast delivery.'

export const metadata: Metadata = {
  metadataBase: new URL('https://fonenova.com'),
  title,
  description,
  openGraph: {
    title,
    description,
    url: 'https://fonenova.com',
    siteName: 'Fonenova',
    images: [{ url: '/images/lineup-dark-1000.jpg', width: 1000, height: 714 }],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/images/lineup-dark-1000.jpg'],
  },
  icons: {
    icon: [
      // Broadest support and the path browsers request unprompted, so it is also
      // what a stale cached favicon gets overwritten by.
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      // The PNGs are 128px rather than 32: browsers downscale them, which keeps the
      // spark's curves clean on a 2x display where a 32px source goes muddy.
      {
        url: '/icon-light-128.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-128.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  // Matches --background in light mode. The toggle rewrites this at runtime, so the
  // browser chrome tracks the chosen theme rather than the operating system's.
  themeColor: '#fcfcfc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before paint so a returning dark-mode visitor never
            flashes white. No stored choice means light: the OS preference is deliberately
            not consulted, so every first-time visitor lands on the light design. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
