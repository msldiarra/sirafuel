'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StationCard } from '@/components/StationCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Station, StationStatus } from '@/lib/supabase/types'
import { calculateDistance } from '@/lib/utils'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

interface StationWithStatus extends StationWithLocation {
  status?: StationStatus
  distance?: number
}

export default function ContributePage() {
  const router = useRouter()
  const [stations, setStations] = useState<StationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadStations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStations() {
    try {
      setLoading(true)

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            })
          },
          () => {}
        )
      }

      const { data: stationsData } = await supabase
        .from('station')
        .select('*')
        .eq('is_active', true)
        .order('name')

      const baseStations = (stationsData || []).map((station) => {
        if (!userLocation) return station

        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          station.latitude,
          station.longitude
        )

        return { ...station, distance }
      })

      const stationIds = baseStations.map((station) => station.id)
      const latestStatusByStation = new Map<string, StationStatus>()

      if (stationIds.length > 0) {
        const { data: statusRows } = await supabase
          .from('station_status')
          .select('*')
          .in('station_id', stationIds)
          .order('updated_at', { ascending: false })

        statusRows?.forEach((row) => {
          if (!latestStatusByStation.has(row.station_id)) {
            latestStatusByStation.set(row.station_id, row)
          }
        })
      }

      const stationsWithStatus = baseStations
        .map((station) => ({
          ...station,
          status: latestStatusByStation.get(station.id),
        }))
        .sort((a, b) => {
          const distanceA = (a as StationWithStatus).distance ?? Number.POSITIVE_INFINITY
          const distanceB = (b as StationWithStatus).distance ?? Number.POSITIVE_INFINITY
          return distanceA - distanceB
        })

      setStations(stationsWithStatus)
    } catch (err) {
      console.error('Error loading stations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredStations = useMemo(() => {
    if (!searchTerm.trim()) return stations
    const term = searchTerm.toLowerCase()
    return stations.filter((station) =>
      station.name.toLowerCase().includes(term) ||
      (station.brand || '').toLowerCase().includes(term) ||
      (station.neighborhood || '').toLowerCase().includes(term) ||
      (station.municipality || '').toLowerCase().includes(term)
    )
  }, [stations, searchTerm])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <header className="bg-gray-800 text-white sticky top-0 z-40 shadow-lg border-b-2 border-gray-700">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold tracking-tight">Contribuer</h1>
          <p className="text-sm text-gray-200">Aidez la communauté en partageant l&apos;état des stations</p>
        </div>
      </header>

      <main className="px-4 py-4">
        {stations.length === 0 ? (
          <EmptyState
            icon="⛽"
            title="Aucune station trouvée"
            description="Aucune station active disponible."
          />
        ) : (
          <div>
            <div className="sticky top-[72px] z-30 bg-gray-900 pb-4">
              <div className="relative">
                <input
                  id="station-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une station"
                  className="w-full bg-gray-800 border-2 border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200"
                    type="button"
                    aria-label="Effacer la recherche"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {filteredStations.length === 0 && (
              <div className="text-sm text-gray-400 mb-4">
                Aucune station ne correspond à « {searchTerm} ».
              </div>
            )}

            {filteredStations.map((station) => (
              <div key={station.id} onClick={() => router.push(`/station/${station.id}`)}>
                <StationCard station={station} status={station.status} distance={station.distance} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

