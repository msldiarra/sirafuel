'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  type: ToastType
  message: string
  duration?: number
  onClose?: () => void
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-500 border-emerald-400 text-white',
  error: 'bg-red-600 border-red-500 text-white',
  info: 'bg-blue-500 border-blue-400 text-white',
  warning: 'bg-amber-500 border-amber-400 text-white',
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

export function Toast({ type, message, duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl shadow-2xl border-2 ${TOAST_STYLES[type]} transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-[-20px]' : 'opacity-100 translate-y-0'
      }`}
      style={{ maxWidth: '90vw', width: 'auto', minWidth: '280px' }}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold">{TOAST_ICONS[type]}</div>
        <div className="flex-1 font-semibold text-sm">{message}</div>
        <button
          onClick={() => {
            setIsExiting(true)
            setTimeout(() => {
              setIsVisible(false)
              onClose?.()
            }, 300)
          }}
          className="text-white/80 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Array<{ id: string; type: ToastType; message: string }>
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

