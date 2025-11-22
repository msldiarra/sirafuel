'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FuelStatusIcon } from '@/components/ui/FuelStatusIcon'
import { formatTimeAgo, getAvailabilityLabel } from '@/lib/utils'
import type { Station, StationStatus, StationUpdateNotification } from '@/lib/supabase/types'

export default function UpdateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const updateId = params.updateId as string
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<StationUpdateNotification | null>(null)
  const [station, setStation] = useState<Station | null>(null)
  const [status, setStatus] = useState<StationStatus | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadUpdateData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateId])

  async function loadUpdateData() {
    try {
      // Get notification
      const { data: notificationData, error: notifError } = await supabase
        .from('station_update_notification')
        .select('*')
        .eq('id', updateId)
        .single()

      if (notifError || !notificationData) {
        console.error('Error loading notification:', notifError)
        return
      }

      setNotification(notificationData)

      // Mark as read
      await supabase
        .from('station_update_notification')
        .update({ is_read: true })
        .eq('id', updateId)

      // Get station
      const { data: stationData } = await supabase
        .from('station')
        .select('*')
        .eq('id', notificationData.station_id)
        .single()

      setStation(stationData)

      // Get station status
      const { data: statusData } = await supabase
        .from('station_status')
        .select('*')
        .eq('id', notificationData.station_status_id)
        .single()

      setStatus(statusData)
    } catch (err) {
      console.error('Error loading update data:', err)
    } finally {
      setLoading(false)
    }
  }

  function shareOnWhatsApp() {
    if (!station || !status) return

    const fuelTypeLabel = status.fuel_type === 'ESSENCE' ? 'Essence' : 'Gasoil'
    const availabilityLabel = getAvailabilityLabel(status.availability)
    const waitTime = status.waiting_time_max
      ? `${status.waiting_time_min}-${status.waiting_time_max} min`
      : 'Non disponible'

    const message = `🚗 Mise à jour - ${station.name}\n\n` +
      `📍 ${station.neighborhood}, ${station.municipality}\n\n` +
      `${fuelTypeLabel}: ${availabilityLabel}\n` +
      `⏱️ Temps d'attente: ${waitTime}\n\n` +
      `Mis à jour ${formatTimeAgo(status.updated_at)}\n\n` +
      `${typeof window !== 'undefined' ? window.location.href : ''}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  if (!notification || !station || !status) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">❌ Mise à jour introuvable</div>
          <Button variant="primary" onClick={() => router.push('/')}>
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    )
  }

  const fuelTypeLabel = status.fuel_type === 'ESSENCE' ? 'Essence' : 'Gasoil'

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 shadow-xl border-b-2 border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Mise à jour</h1>
              <p className="text-xs text-gray-400 mt-0.5">Détails de la station</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Station Info Card */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{station.name}</h2>
              {station.brand && (
                <span className="inline-block px-2 py-0.5 bg-gray-700 text-gray-300 text-xs font-semibold rounded mb-2">
                  {station.brand}
                </span>
              )}
              <p className="text-gray-400">
                📍 {station.neighborhood}, {station.municipality}
              </p>
            </div>
          </div>
        </Card>

        {/* Status Update Card */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Mise à jour du statut</h3>
            <span className="text-xs text-gray-500">{formatTimeAgo(status.updated_at)}</span>
          </div>

          <div className="space-y-4">
            {/* Fuel Type Status */}
            <div className="flex items-center justify-between p-4 bg-gray-700/60 rounded-xl border border-gray-600">
              <div className="flex items-center gap-3 flex-1">
                <FuelStatusIcon status={status.availability} size={40} />
                <div>
                  <div className="font-semibold text-white text-lg">{fuelTypeLabel}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Source: {status.last_update_source === 'OFFICIAL' ? 'Officielle' : status.last_update_source === 'TRUSTED' ? 'Vérifiée' : 'Publique'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {getAvailabilityLabel(status.availability)}
                </div>
              </div>
            </div>

            {/* Waiting Time */}
            {status.waiting_time_min !== null && status.waiting_time_max !== null && (
              <div className="p-4 bg-gray-700/60 rounded-xl border border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-300 font-medium">Temps d&apos;attente estimé</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-400">
                    {status.waiting_time_min}-{status.waiting_time_max} min
                  </span>
                </div>
              </div>
            )}

            {/* Pumps Active */}
            {status.pumps_active !== null && (
              <div className="p-4 bg-gray-700/60 rounded-xl border border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium">Pompes actives</span>
                  <span className="text-lg font-bold text-white">{status.pumps_active}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Share Button */}
        <Button
          variant="primary"
          fullWidth
          onClick={shareOnWhatsApp}
          className="hover-glow transition-all"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Partager sur WhatsApp
          </span>
        </Button>

        {/* View Station Button */}
        <Button
          variant="outline"
          fullWidth
          onClick={() => router.push(`/station/${station.id}`)}
        >
          Voir la station complète
        </Button>
      </main>
    </div>
  )
}

