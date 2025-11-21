import { getBrandIcon } from './icons/BrandIcons'
import { DefaultPumpIcon } from './icons/DefaultPumpIcon'
import { MarkerPin } from './MarkerPin'
import { extractBrandFromName } from '@/lib/station-utils'
import type { Station, StationStatus } from '@/lib/supabase/types'

interface StationMarkerProps {
  station: Station
  status?: StationStatus
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
}

export function StationMarker({ station, status, onClick, size = 'medium' }: StationMarkerProps) {
  const availability = status?.availability || null
  
  // Extract brand from name if not set
  const brand = extractBrandFromName(station.name, station.brand)
  const brandIcon = brand ? getBrandIcon(brand, 'w-full h-full') : null

  // Size configuration
  const sizeConfig = {
    small: {
      scale: 0.15,
      iconSize: 20,
    },
    medium: {
      scale: 0.2,
      iconSize: 28,
    },
    large: {
      scale: 0.25,
      iconSize: 35,
    },
  }

  const config = sizeConfig[size]

  // Pin color based on fuel availability
  // Green if available, red if out or no fuel, yellow if limited
  const pinColor =
    availability === 'AVAILABLE'
      ? '#10B981' // emerald
      : availability === 'LIMITED'
      ? '#F97316' // orange
      : availability === 'OUT'
      ? '#EF4444' // red
      : '#9CA3AF' // slate for unknown

  return (
    <button
      onClick={onClick}
      className="relative cursor-pointer transition-transform hover:scale-110 active:scale-95"
      style={{ width: `${375 * config.scale}px`, height: `${375 * config.scale}px` }}
    >
      <MarkerPin color={pinColor} size={config.scale}>
        {/* Brand icon or default pump inside the circle */}
        <div
          className="flex items-center justify-center"
          style={{ 
            width: `${config.iconSize}px`, 
            height: `${config.iconSize}px`,
          }}
        >
          {brandIcon ? (
            <div className="w-full h-full flex items-center justify-center">
              {brandIcon}
            </div>
          ) : (
            <DefaultPumpIcon 
              size={config.iconSize * 0.7} 
              className="text-black" 
            />
          )}
        </div>
      </MarkerPin>
    </button>
  )
}

