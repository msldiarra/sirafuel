'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StationCard } from '@/components/StationCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notifications } from '@/components/ui/Notifications'
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

export default function TrustedPage() {
  const router = useRouter()
  const [stations, setStations] = useState<StationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadStations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuthAndLoadStations() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile || profile.role !== 'TRUSTED_REPORTER') {
        router.push('/')
        return
      }

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

      await loadStations()
    } catch (err) {
      console.error('Error loading trusted page:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadStations() {
    const { data: allStations } = await supabase
      .from('station')
      .select('*')
      .eq('is_active', true)

    if (allStations) {
      let processedStations = allStations

      // Calculate distances if user location available
      if (userLocation) {
        processedStations = allStations
          .map((station) => {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lon,
              station.latitude,
              station.longitude
            )
            return { ...station, distance }
          })
          .filter((s) => s.distance <= 50)
          .sort((a, b) => a.distance - b.distance)
      }

      // Load statuses
      const stationsWithStatus = await Promise.all(
        processedStations.map(async (station) => {
          const { data: status } = await supabase
            .from('station_status')
            .select('*')
            .eq('station_id', station.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          return { ...station, status }
        })
      )

      setStations(stationsWithStatus)
    }
  }

  function handleOpenModal(station: StationWithStatus) {
    // Navigate to trusted station detail page
    router.push(`/trusted/${station.id}`)
  }

  const filteredStations = stations.filter((station) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      station.name.toLowerCase().includes(query) ||
      station.municipality.toLowerCase().includes(query) ||
      station.neighborhood.toLowerCase().includes(query) ||
      station.brand?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-400">Chargement...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">

      <header className="bg-gray-800 text-white sticky top-0 z-40 shadow-lg border-b-2 border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rapporteur Vérifié</h1>
            <p className="text-sm text-gray-200">Mises à jour prioritaires pour la communauté</p>
          </div>
          <Notifications />
        </div>
      </header>

      <main className="px-4 py-4">
        {stations.length === 0 ? (
          <EmptyState
            icon="📍"
            title="Aucune station trouvée"
            description="Aucune station active trouvée dans votre région."
          />
        ) : (
          <div>
            <div className="sticky top-[72px] z-30 bg-gray-900 pb-4">
              <div className="relative">
                <input
                  id="station-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une station"
                  className="w-full bg-gray-800 border-2 border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
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
                Aucune station ne correspond à « {searchQuery} ».
              </div>
            )}

            {filteredStations.map((station, index) => (
              <div
                key={station.id}
                className="animate-slide-in-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <StationCard
                  station={station}
                  status={station.status}
                  distance={station.distance}
                  onClick={() => handleOpenModal(station)}
                  href={`/trusted/${station.id}`}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
