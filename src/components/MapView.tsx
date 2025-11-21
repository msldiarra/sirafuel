'use client'

import { useEffect, useRef, useState } from 'react'
import Map, { Marker, Popup, MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Station, StationStatus } from '@/lib/supabase/types'
import { getAvailabilityLabel } from '@/lib/utils'
import { StationMarker } from './StationMarker'
import Link from 'next/link'
import { LngLatBounds } from 'maplibre-gl'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

interface StationWithStatus extends StationWithLocation {
  status?: StationStatus
  distance?: number
}

interface MapViewProps {
  stations: StationWithStatus[]
  userLocation: { lat: number; lon: number } | null
  onStationClick?: (station: StationWithStatus) => void
}

export default function MapView({ stations, userLocation, onStationClick }: MapViewProps) {
  const [selectedStation, setSelectedStation] = useState<StationWithStatus | null>(null)
  const [mapStyle, setMapStyle] = useState(
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  )
  const mapRef = useRef<MapRef | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  // Calculate center from stations or use default (Bamako)
  const center = userLocation || {
    lat: stations.length > 0
      ? stations.reduce((sum, s) => sum + s.latitude, 0) / stations.length
      : 12.6392,
    lon: stations.length > 0
      ? stations.reduce((sum, s) => sum + s.longitude, 0) / stations.length
      : -8.0029,
  }

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return
    const coordinates = stations.map((station) => [station.longitude, station.latitude] as [number, number])

    if (userLocation) {
      coordinates.push([userLocation.lon, userLocation.lat])
    }

    if (coordinates.length === 0) return

    if (coordinates.length === 1) {
      mapRef.current.flyTo({
        center: coordinates[0],
        zoom: userLocation ? 13 : 12,
        duration: 600,
      })
      return
    }

    const bounds = coordinates.reduce(
      (acc, coord) => {
        if (!acc) {
          return new LngLatBounds(coord, coord)
        }
        return acc.extend(coord)
      },
      null as LngLatBounds | null
    )

    if (bounds) {
      mapRef.current.fitBounds(bounds, {
        padding: 60,
        duration: 700,
      })
    }
  }, [stations, userLocation, isMapReady])

  return (
    <div className="w-full h-[calc(100vh-200px)] relative">
      <Map
        ref={mapRef}
        onLoad={() => setIsMapReady(true)}
        initialViewState={{
          latitude: userLocation?.lat || center.lat,
          longitude: userLocation?.lon || center.lon,
          zoom: userLocation ? 13 : 12,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
      >
        {/* User location marker */}
        {userLocation && (
          <Marker latitude={userLocation.lat} longitude={userLocation.lon} anchor="center">
            <div className="relative">
              {/* Pulsing circle animation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full opacity-20 animate-ping" />
              </div>
              {/* Outer circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full opacity-30" />
              </div>
              {/* Inner dot */}
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg" />
              </div>
            </div>
          </Marker>
        )}

        {/* Station markers */}
        {stations.map((station) => (
          <Marker
            key={station.id}
            latitude={station.latitude}
            longitude={station.longitude}
            anchor="bottom"
          >
            <StationMarker
              station={station}
              status={station.status}
              onClick={() => {
                setSelectedStation(station)
                onStationClick?.(station)
              }}
              size="medium"
            />
          </Marker>
        ))}

        {/* Popup for selected station */}
        {selectedStation && (
          <Popup
            latitude={selectedStation.latitude}
            longitude={selectedStation.longitude}
            onClose={() => setSelectedStation(null)}
            closeButton={true}
            closeOnClick={false}
            anchor="bottom"
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-bold text-lg mb-1">{selectedStation.name}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {selectedStation.neighborhood}, {selectedStation.municipality}
              </p>
              {selectedStation.status && (
                <div className="mb-2">
                  <div className="text-sm">
                    <span className="font-semibold">Statut:</span>{' '}
                    {getAvailabilityLabel(selectedStation.status.availability)}
                  </div>
                  {selectedStation.status.waiting_time_min &&
                    selectedStation.status.waiting_time_max && (
                      <div className="text-sm">
                        <span className="font-semibold">Attente:</span>{' '}
                        {selectedStation.status.waiting_time_min}-
                        {selectedStation.status.waiting_time_max} min
                      </div>
                    )}
                </div>
              )}
              <Link
                href={`/station/${selectedStation.id}`}
                className="block w-full mt-2 bg-primary-orange text-white text-center py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                VOIR DÉTAILS
              </Link>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}

