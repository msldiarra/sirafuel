'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [wasDismissed, setWasDismissed] = useState(true) // Default to true to prevent SSR issues
  const wasDismissedRef = useRef(true)

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      return
    }

    // Check if user dismissed recently (within last 24 hours)
    const dismissedTime = localStorage.getItem('pwa-install-dismissed')
    if (dismissedTime) {
      const hoursSinceDismiss = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60)
      if (hoursSinceDismiss < 24) {
        wasDismissedRef.current = true
        setWasDismissed(true)
        return // Don't show if dismissed recently
      }
    }
    wasDismissedRef.current = false
    setWasDismissed(false)

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App is already installed (standalone mode)')
      setIsInstalled(true)
      return
    }

    // Check if running as standalone (iOS)
    if ((window.navigator as any).standalone === true) {
      console.log('App is already installed (iOS standalone)')
      setIsInstalled(true)
      return
    }

    // Check if PWA is installable
    const checkInstallability = async () => {
      // Check if service worker is registered
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            console.log('Service worker is registered, app might be installable')
            setCanInstall(true)
          } else {
            console.log('Service worker not yet registered')
          }
        } catch (error) {
          console.error('Error checking service worker:', error)
        }
      }
    }

    // Listen for the beforeinstallprompt event (main way to detect installability)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ beforeinstallprompt event fired - app is installable!')
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setCanInstall(true)
      // Show prompt after a short delay to ensure page is loaded
      setTimeout(() => {
        if (!wasDismissedRef.current) {
          setShowPrompt(true)
        }
      }, 1000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if app was just installed
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully')
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Check installability on load
    checkInstallability()

    // Also check after delays (service worker might take time to register)
    const timeout1 = setTimeout(() => {
      checkInstallability()
    }, 1000)

    const timeout2 = setTimeout(() => {
      checkInstallability()
      // If we can install but beforeinstallprompt hasn't fired, 
      // show prompt after user interaction (fallback for some browsers)
      const handleUserInteraction = () => {
        console.log('User interacted, showing install prompt')
        // Check localStorage directly to get latest value
        const dismissedTime = localStorage.getItem('pwa-install-dismissed')
        const shouldShow = !dismissedTime || (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60) >= 24
        if (shouldShow) {
          setShowPrompt(true)
        }
      }
      // Wait for any user interaction
      window.addEventListener('click', handleUserInteraction, { once: true })
      window.addEventListener('touchstart', handleUserInteraction, { once: true })
      window.addEventListener('keydown', handleUserInteraction, { once: true })
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearTimeout(timeout1)
      clearTimeout(timeout2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Use the deferred prompt if available
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        setShowPrompt(false)
        setDeferredPrompt(null)
      }
    } else {
      // Fallback: try to trigger browser's install UI
      // This works for browsers that support PWA installation
      // The browser will show its own install prompt
      console.log('No deferred prompt available, browser should show install option in address bar')
      // For some browsers, we can't programmatically trigger, but user can use browser UI
      alert('Pour installer l\'application, utilisez le menu de votre navigateur (icône + ou menu > Installer l\'application)')
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Store dismissal in localStorage to avoid showing again for this session
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Don't show if already installed or was dismissed
  if (isInstalled || wasDismissed || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 md:bottom-4 md:left-4 md:right-auto md:max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            Installer TajiCheck
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Installez l&apos;application pour un accès rapide et une meilleure expérience.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

