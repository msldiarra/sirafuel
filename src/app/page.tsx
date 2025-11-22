'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StationCard } from '@/components/StationCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { RangeSlider } from '@/components/ui/RangeSlider'
import { TajiCheckLogo } from '@/components/ui/TajiCheckLogo'
import { calculateDistance } from '@/lib/utils'
import type { Station, StationStatus } from '@/lib/supabase/types'
import dynamic from 'next/dynamic'

// Dynamically import map to reduce initial bundle size
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

type ViewMode = 'list' | 'map'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

interface StationWithStatus extends StationWithLocation {
  status?: StationStatus
  statuses?: StationStatus[]
  distance?: number
}

const DEFAULT_RADIUS_KM = 5 // Rayon de recherche par défaut en kilomètres

export default function HomePage() {
  const [stations, setStations] = useState<StationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [fuelFilter, setFuelFilter] = useState<'ESSENCE' | 'GASOIL' | 'ALL'>('ALL')
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_KM)
  const [debouncedRadius, setDebouncedRadius] = useState<number>(DEFAULT_RADIUS_KM)
  const [showRadiusSlider, setShowRadiusSlider] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  // Debounce radius changes to avoid too many reloads
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRadius(radius)
    }, 300)

    return () => clearTimeout(timer)
  }, [radius])

  useEffect(() => {
    // Get user location first (required)
    getLocation()
  }, [])

  useEffect(() => {
    // Load stations only when we have location
    if (userLocation) {
      loadStations()
      subscribeToUpdates()
    }
  }, [userLocation, fuelFilter, debouncedRadius]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius)
  }, [])

  function getLocation() {
    setLocationLoading(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('La géolocalisation n\'est pas supportée par votre navigateur')
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setLocationLoading(false)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position.'
            : 'Impossible d\'obtenir votre position. Veuillez réessayer.'
        )
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  function loadStations() {
    if (!userLocation) return

    const { lat: userLat, lon: userLon } = userLocation

    async function fetchStations() {
      try {
        setLoading(true)
        setError(null)

      // Load all active stations
      const { data: stationsData, error: stationsError } = await supabase
        .from('station')
        .select('*')
        .eq('is_active', true)

      if (stationsError) throw stationsError

      // Calculate distance and filter stations within radius
      const stationsWithDistance = (stationsData || [])
        .map((station) => {
          const distance = calculateDistance(
            userLat,
            userLon,
            station.latitude,
            station.longitude
          )
          return { ...station, distance }
        })
        .filter((station) => station.distance <= debouncedRadius)
        .sort((a, b) => a.distance - b.distance) // Sort by distance

      // Get all statuses (ESSENCE + GASOIL) for each station
      const stationsWithStatus: StationWithStatus[] = await Promise.all(
        stationsWithDistance.map(async (station) => {
          // Get all statuses for this station (both fuel types)
          const { data: allStatuses } = await supabase
            .from('station_status')
            .select('*')
            .eq('station_id', station.id)
            .order('updated_at', { ascending: false })

          // Store all statuses in the station object for filtering later
          return { 
            ...station, 
            statuses: allStatuses || [],
            status: allStatuses?.[0] || undefined // Most recent status for display
          }
        })
      )

      setStations(stationsWithStatus)
    } catch (err) {
      console.error('Error loading stations:', err)
      setError('Erreur lors du chargement des stations')
      } finally {
        setLoading(false)
      }
    }

    fetchStations()
  }

  function subscribeToUpdates() {
    const channel = supabase
      .channel('station-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'station_status',
        },
        () => {
          // Reload stations when status changes
          loadStations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Filter stations by fuel type and search term
  const filteredStations = useMemo(() => {
    let filtered = stations
      .map((station) => {
        // If filtering by specific fuel type, find the latest status for that type
        if (fuelFilter !== 'ALL' && station.statuses) {
          const relevantStatus = station.statuses.find(s => s.fuel_type === fuelFilter)
          return {
            ...station,
            status: relevantStatus || undefined
          }
        }
        return station
      })
      .filter((station) => {
        // Keep all stations when "Tous" is selected
        if (fuelFilter === 'ALL') return true
        // Only keep stations that have the selected fuel type
        return station.status !== undefined
      })

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((station) =>
        station.name.toLowerCase().includes(term) ||
        (station.brand || '').toLowerCase().includes(term) ||
        (station.neighborhood || '').toLowerCase().includes(term) ||
        (station.municipality || '').toLowerCase().includes(term)
      )
    }

    return filtered
  }, [stations, fuelFilter, searchTerm])

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 text-white sticky top-0 z-40 shadow-lg border-b border-gray-700">
        <div className="px-4 py-3">
          {/* Ligne 1 : Logo uniquement */}
          <div className="flex items-center justify-between mb-2">
            <TajiCheckLogo />
          </div>

          {/* Ligne 2 : Texte rayon + Bouton Carte - Only show when location is available */}
          {userLocation && (
            <>
              <div className="flex items-start justify-between gap-4 mb-3">
                {/* Texte + Settings */}
                <div className="flex items-center gap-2 max-w-[65%]">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-200 leading-tight">
                      Stations dans un rayon de {debouncedRadius} km
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRadiusSlider(!showRadiusSlider)}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors self-start sm:self-center"
                    title="Ajuster le rayon"
                  >
                    ⚙️
                  </button>
                </div>

                {/* Bouton Carte/Liste */}
                <div className="flex items-center gap-2 bg-gray-700/40 border border-gray-600 rounded-xl px-3 py-1.5 shadow-inner whitespace-nowrap">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vue</span>
                  <button
                    onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                    className="px-3 py-1.5 bg-primary-teal hover:bg-teal-600 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                  >
                    {viewMode === 'list' ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M9 20.25 3.75 18V4.75L9 6.75l6-2 5.25 2v13.25L15 18.25l-6 2Z" />
                          <path d="m9 6.75 6 1.5v11" />
                        </svg>
                        <span>Carte</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 6h16" />
                          <path d="M4 12h16" />
                          <path d="M4 18h16" />
                        </svg>
                        <span>Liste</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ligne 3 : Filtres */}
              <div className="flex gap-1 bg-gray-700/50 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setFuelFilter('ALL')}
                  className={`px-3 py-2 rounded text-sm font-semibold transition-all flex-1 ${
                    fuelFilter === 'ALL'
                      ? 'bg-primary-teal text-white shadow-md'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFuelFilter('ESSENCE')}
                  className={`px-3 py-2 rounded text-sm font-semibold transition-all flex-1 ${
                    fuelFilter === 'ESSENCE'
                      ? 'bg-primary-teal text-white shadow-md'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  Essence
                </button>
                <button
                  onClick={() => setFuelFilter('GASOIL')}
                  className={`px-3 py-2 rounded text-sm font-semibold transition-all flex-1 ${
                    fuelFilter === 'GASOIL'
                      ? 'bg-primary-teal text-white shadow-md'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  Gasoil
                </button>
              </div>

              {/* Ligne 4 : Recherche */}
              <div className="mt-3">
                <div className="relative">
                  <input
                    id="station-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher une station"
                    className="w-full bg-gray-700 border-2 border-gray-600 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
                      type="button"
                      aria-label="Effacer la recherche"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Radius Slider - Only show when location is available and slider is toggled */}
          {userLocation && showRadiusSlider && (
            <div className="mt-3 bg-gray-700/60 backdrop-blur-sm rounded-lg p-3 border border-gray-600 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide">Réglage du rayon</p>
                  <p className="text-sm text-gray-200">Affinez le périmètre de recherche</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRadiusSlider(false)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-gray-200 bg-gray-600/70 hover:bg-gray-500/80 rounded-full transition-colors"
                >
                  <span>Fermer</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <RangeSlider
                min={1}
                max={20}
                defaultValue={debouncedRadius}
                step={1}
                unit="km"
                onChange={handleRadiusChange}
              />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="pb-20">
        {/* Location Loading State */}
        {locationLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 border-4 border-primary-teal border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-gray-300 text-center">
              <p className="font-medium mb-1">Localisation en cours...</p>
              <p className="text-sm text-gray-400">Autorisez l&apos;accès à votre position pour voir les stations à proximité</p>
            </div>
          </div>
        )}

        {/* Location Error State */}
        {!locationLoading && locationError && (
          <div className="px-4 py-8">
            <EmptyState
              icon="📍"
              title="Géolocalisation requise"
              description={locationError}
              actionLabel="Réessayer"
              onAction={getLocation}
            />
          </div>
        )}

        {/* Loading Stations */}
        {userLocation && loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-gray-400">Chargement des stations...</div>
          </div>
        )}

        {/* Error Loading Stations */}
        {userLocation && !loading && error && (
          <div className="px-4 py-8">
            <EmptyState
              icon="⚠️"
              title="Erreur"
              description={error}
              actionLabel="Réessayer"
              onAction={loadStations}
            />
          </div>
        )}

        {/* No Stations Found */}
        {userLocation && !loading && !error && filteredStations.length === 0 && (
          <div className="px-4 py-8">
            <EmptyState
              icon="⛽"
              title="Aucune station à proximité"
              description={`Aucune station trouvée dans un rayon de ${debouncedRadius} km. Essayez d'augmenter le rayon ou de modifier le filtre de carburant.`}
              actionLabel="Réinitialiser les filtres"
              onAction={() => {
                setFuelFilter('ALL')
                setRadius(DEFAULT_RADIUS_KM)
              }}
            />
          </div>
        )}

        {/* Stations Found */}
        {userLocation && !loading && !error && filteredStations.length > 0 && (
          <>
            {/* Info banner */}
            <div className="px-4 py-3 bg-gray-800 border-b-2 border-gray-700">
              <p className="text-base font-semibold text-gray-100">
                {filteredStations.length} station{filteredStations.length > 1 ? 's' : ''} trouvée{filteredStations.length > 1 ? 's' : ''} dans un rayon de {debouncedRadius} km
              </p>
            </div>

            {viewMode === 'list' ? (
              <div className="px-4 py-4">
                {filteredStations.length === 0 && searchTerm && (
                  <div className="text-sm text-gray-400 mb-4">
                    Aucune station ne correspond à &laquo; {searchTerm} &raquo;.
                  </div>
                )}
                {filteredStations.map((station) => (
                  <StationCard key={station.id} station={station} status={station.status} distance={station.distance} />
                ))}
              </div>
            ) : (
              <MapView
                stations={filteredStations}
                userLocation={userLocation}
                onStationClick={(station) => {
                  window.location.href = `/station/${station.id}`
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

