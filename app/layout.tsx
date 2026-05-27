import type { Metadata } from 'next'
import { Inter, Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import PWAInstall from './pwa-install/page'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-barlow' })
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-barlow-condensed' })

export const metadata: Metadata = {
  title: 'Uptimyzas Kitchen',
  description: 'Restaurant Management System',
  manifest: '/manifest.json',
  themeColor: '#8B0000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Uptimyzas',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${inter.variable} ${barlow.variable} ${barlowCondensed.variable} font-body`}>
        {children}
        <PWAInstall />
      </body>
    </html>
  )
}