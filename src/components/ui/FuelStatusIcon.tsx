'use client'

import { useId } from 'react'
import type { StationStatus } from '@/lib/supabase/types'

type Availability = StationStatus['availability'] | null | undefined

interface FuelStatusIconProps {
  status: Availability
  size?: number
}

export function FuelStatusIcon({ status, size = 48 }: FuelStatusIconProps) {
  const clipId = useId()

  let strokeClass = 'text-slate-300'
  let fillColor = '#9CA3AF'
  let fillLevel = 0
  let accentElement: React.ReactNode = null

  switch (status) {
    case 'AVAILABLE':
      strokeClass = 'text-emerald-400'
      fillColor = '#10B981'
      fillLevel = 1
      accentElement = (
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
      )
      break
    case 'LIMITED':
      strokeClass = 'text-orange-400'
      fillColor = '#F97316'
      fillLevel = 0.5
      accentElement = (
        <span className="pointer-events-none absolute inset-0 rounded-full bg-orange-400/10 animate-pulse" />
      )
      break
    case 'OUT':
      strokeClass = 'text-red-400'
      fillColor = '#EF4444'
      fillLevel = 0
      accentElement = null
      break
    default:
      strokeClass = 'text-slate-400'
      fillColor = '#6B7280'
      fillLevel = 0
  }

  const bodyHeight = 12
  const bodyWidth = 8
  const padding = 0.8

  const effectiveHeight = Math.max(0, (bodyHeight - padding * 2) * fillLevel)
  const fillY = 4 + bodyHeight - padding - effectiveHeight

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {accentElement}
      <svg
        width={size * 0.8}
        height={size * 0.8}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-300 ${strokeClass} ${
          fillLevel === 1 ? 'scale-100' : fillLevel === 0.5 ? 'scale-95' : 'scale-90'
        }`}
      >
        <defs>
          <clipPath id={`${clipId}-pump-body`}>
            <rect x="6" y="4" width={bodyWidth} height={bodyHeight} rx="1" />
          </clipPath>
        </defs>

        {/* Pump body background */}
        <rect
          x="6"
          y="4"
          width={bodyWidth}
          height={bodyHeight}
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={status === 'OUT' ? 'rgba(239,68,68,0.12)' : 'rgba(15,23,42,0.85)'}
        />

        {/* Fuel level */}
        {effectiveHeight > 0 && (
          <rect
            x={6 + padding}
            y={fillY}
            width={bodyWidth - padding * 2}
            height={effectiveHeight}
            fill={fillColor}
            clipPath={`url(#${clipId}-pump-body)`}
            className="transition-all duration-500 ease-out"
            rx={0.6}
          />
        )}

        {/* Screen */}
        <rect
          x="7.5"
          y="5.5"
          width="5"
          height="3"
          rx="0.5"
          stroke="currentColor"
          strokeWidth="1"
          fill={status === 'OUT' ? 'rgba(239,68,68,0.18)' : 'rgba(30,41,59,0.7)'}
        />

        {/* Nozzle and hose */}
        <path
          d="M14 8C14 8 16 8 16 10V12C16 12 16 14 14 14"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Base */}
        <rect
          x="5"
          y="16"
          width="10"
          height="2"
          rx="0.5"
          fill="currentColor"
          opacity="0.25"
        />
      </svg>
    </div>
  )
}


