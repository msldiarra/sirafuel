import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ConditionalBottomNav } from '@/components/ui/ConditionalBottomNav'
import { ServiceWorkerRegistration } from '@/components/ui/ServiceWorkerRegistration'
import { InstallPrompt } from '@/components/ui/InstallPrompt'

export const metadata: Metadata = {
  title: 'TajiCheck - Disponibilité de carburant au Mali',
  description: 'Plateforme participative de suivi de la disponibilité de carburant et des files d\'attente au Mali',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TajiCheck',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#14B8A6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ConditionalBottomNav />
        <ServiceWorkerRegistration />
        <InstallPrompt />
      </body>
    </html>
  )
}

