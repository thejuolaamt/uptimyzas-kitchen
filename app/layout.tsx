import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import PWAInstall from './pwa-install/page'
import { ToastProvider } from '@/lib/toast'

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-geist',
  display: 'swap',
})

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
      <body className={`${geist.variable} font-body`}>
        <ToastProvider>
          {children}
          <PWAInstall />
        </ToastProvider>
      </body>
    </html>
  )
}