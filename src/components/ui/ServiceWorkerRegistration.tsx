'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Register service worker in both dev and production
    // Note: PWA install prompt typically only works in production/HTTPS
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration)
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('Service Worker update found')
        })
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error)
        // Don't show error to user, just log it
      })

    // Handle service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed')
      // Optionally reload the page to get the new service worker
      // window.location.reload()
    })
  }, [])

  return null
}

