'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Button } from '@/components/ui/Button'

interface SearchResult {
  lat: string
  lon: string
  display_name: string
  name?: string
}

function MapPickerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)

  // Get initial coordinates from URL params if provided
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
      center: [initialLng || -8.0, initialLat || 12.65],
      zoom: 12,
    })

    // Add click handler to map
    map.current.on('click', (e) => {
      const { lat, lng } = e.lngLat
      setSelectedLocation({
        lat,
        lng,
        name: ``,
      })

      // Remove old marker
      if (marker.current) {
        marker.current.remove()
      }

      // Add new marker
      marker.current = new maplibregl.Marker({ color: '#14B8A6' })
        .setLngLat([lng, lat])
        .addTo(map.current!)
    })

    // Add initial marker if coordinates provided
    if (initialLat && initialLng) {
      setSelectedLocation({ lat: initialLat, lng: initialLng, name: '' })
      marker.current = new maplibregl.Marker({ color: '#14B8A6' })
        .setLngLat([initialLng, initialLat])
        .addTo(map.current)
    }

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [initialLat, initialLng])

  // Search functionality using Nominatim (OpenStreetMap)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)

    if (query.length < 3) {
      setSearchResults([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&countrycodes=ml&format=json&limit=10&viewbox=-12.0,7.0,-8.0,17.0`
      )

      const data: SearchResult[] = await response.json()
      setSearchResults(data)
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle search result selection
  const handleResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const name = result.name || result.display_name.split(',')[0]

    setSelectedLocation({ lat, lng, name })

    // Center map on selected location
    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 15,
      })
    }

    // Remove old marker and add new one
    if (marker.current) {
      marker.current.remove()
    }

    marker.current = new maplibregl.Marker({ color: '#14B8A6' })
      .setLngLat([lng, lat])
      .addTo(map.current!)

    setSearchQuery(name)
    setSearchResults([])
  }

  const handleConfirm = () => {
    if (selectedLocation) {
      // Return to admin page with coordinates in URL params
      const params = new URLSearchParams({
        lat: selectedLocation.lat.toString(),
        lng: selectedLocation.lng.toString(),
        name: selectedLocation.name || '',
      })
      router.push(`/admin?${params.toString()}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Sélectionner une station</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ×
        </button>
      </div>

      {/* Search Box */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0 relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Chercher une station... (ex: Total Bamako)"
            autoFocus
            className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-400"
          />
          {loading && (
            <div className="absolute right-3 top-3.5">
              <div className="w-5 h-5 border-2 border-primary-teal border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-4 right-4 mt-1 bg-gray-700 border-2 border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleResultClick(result)}
                className="w-full text-left px-4 py-3 hover:bg-gray-600 border-b border-gray-600 last:border-b-0 text-sm text-gray-200 transition-colors"
              >
                <div className="font-medium">{result.name || result.display_name.split(',')[0]}</div>
                <div className="text-xs text-gray-400">{result.display_name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map - takes all remaining space */}
      <div ref={mapContainer} className="flex-1 w-full bg-gray-900" />

      {/* Footer Info and Actions - sticky at bottom */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
        {selectedLocation && (
          <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
            <p className="text-gray-300 text-xs">
              <span className="font-semibold">📍 Position:</span>
              <span className="text-primary-teal font-mono ml-2">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </span>
            </p>
            {selectedLocation.name && (
              <p className="text-gray-400 text-xs mt-1">{selectedLocation.name}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="hover-glow transition-all"
          >
            ✓ Confirmer
          </Button>
          <Button variant="outline" fullWidth onClick={() => router.back()}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function MapPickerPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-gray-400">Chargement de la carte...</div>
      </div>
    }>
      <MapPickerContent />
    </Suspense>
  )
}

