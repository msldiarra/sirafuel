import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ConditionalBottomNav } from '@/components/ui/ConditionalBottomNav'

export const metadata: Metadata = {
  title: 'SiraFuel - Disponibilité de carburant au Mali',
  description: 'Plateforme participative de suivi de la disponibilité de carburant et des files d\'attente au Mali',
  manifest: '/manifest.json',
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
      </body>
    </html>
  )
}

