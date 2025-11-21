import Link from 'next/link'
import { formatTimeAgo, getAvailabilityLabel, formatDistance } from '@/lib/utils'
import { extractBrandFromName } from '@/lib/station-utils'
import { getBrandIcon } from './icons/BrandIcons'
import { DefaultPumpIcon } from './icons/DefaultPumpIcon'
import { FuelStatusIcon } from './ui/FuelStatusIcon'
import type { Station, StationStatus } from '@/lib/supabase/types'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

interface StationCardProps {
  station: StationWithLocation
  status?: StationStatus
  distance?: number
  onClick?: () => void
  href?: string
}

export function StationCard({ station, status, distance, onClick, href }: StationCardProps) {
  const availability = status?.availability || null
  const waitingTime = status
    ? status.waiting_time_min && status.waiting_time_max
      ? `${status.waiting_time_min}-${status.waiting_time_max} min`
      : null
    : null

  // Extract brand and get icon
  const brand = extractBrandFromName(station.name, station.brand)
  const brandIcon = brand ? getBrandIcon(brand, 'w-10 h-10') : <DefaultPumpIcon size={40} className="text-gray-400" />

  const statusColorClass =
    availability === 'AVAILABLE'
      ? 'text-emerald-300'
      : availability === 'LIMITED'
      ? 'text-orange-300'
      : availability === 'OUT'
      ? 'text-red-300'
      : 'text-gray-300'

  const cardContent = (
    <div className="bg-gray-800 rounded-xl shadow-lg border-2 border-gray-700 p-4 mb-4 active:bg-gray-750 hover:shadow-xl hover:border-primary-teal/50 transition-all">
        <div className="flex items-start gap-3 mb-3">
          {/* Brand Icon */}
          <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-gray-700 rounded-lg border-2 border-gray-600">
            {brandIcon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-white truncate leading-tight">{station.name}</h3>
            {brand && (
              <p className="text-base font-medium text-gray-300 mt-0.5">{brand}</p>
            )}
            <p className="text-sm font-normal text-gray-400 truncate mt-0.5">{station.neighborhood}, {station.municipality}</p>
          </div>
          
          {/* Status Icon */}
          <div className="flex-shrink-0">
            <FuelStatusIcon status={availability} size={52} />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t-2 border-gray-700">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-400">
              {availability === 'OUT' ? 'Statut:' : 'Attente:'}
            </span>
            <span className={`text-base font-bold ${statusColorClass}`}>
              {availability === 'OUT' ? 'Carburant indisponible' : waitingTime || 'Non précisée'}
            </span>
          </div>
        </div>

        {status && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-gray-700">
            <div className="text-xs font-normal text-gray-500">
              Mis à jour {formatTimeAgo(status.updated_at)}
            </div>
            {distance !== undefined && (
              <div className="text-base font-bold text-primary-teal">
                {formatDistance(distance)}
              </div>
            )}
          </div>
        )}
      </div>
  )

  // If onClick is provided, use a div instead of Link
  if (onClick) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        {cardContent}
      </div>
    )
  }

  // Use custom href if provided, otherwise default to /station/[id]
  const cardHref = href || `/station/${station.id}`

  return (
    <Link href={cardHref}>
      {cardContent}
    </Link>
  )
}

