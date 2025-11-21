'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatTimeAgo, getAvailabilityLabel } from '@/lib/utils'
import { FuelStatusIcon } from '@/components/ui/FuelStatusIcon'
import { Toast, ToastContainer, type ToastType } from '@/components/ui/Toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import type { Station, StationStatus, FuelType, Availability, QueueCategory } from '@/lib/supabase/types'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

type SelectedStatuses = Record<FuelType, Availability | null>

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export default function TrustedStationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const stationId = params.id as string

  const [station, setStation] = useState<StationWithLocation | null>(null)
  const [statuses, setStatuses] = useState<StationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<SelectedStatuses>({
    ESSENCE: null,
    GASOIL: null,
  })
  const [queueHours, setQueueHours] = useState<number | null>(null)
  const [queueTouched, setQueueTouched] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const supabase = createClient()

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    checkAuthAndLoadStation()
    subscribeToUpdates()
  }, [stationId])

  async function checkAuthAndLoadStation() {
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

      await loadStationData()
    } catch (err) {
      console.error('Error loading trusted station:', err)
      showToast('error', 'Erreur lors du chargement de la station')
    } finally {
      setLoading(false)
    }
  }

  async function loadStationData() {
    try {
      // Load station
      const { data: stationData, error: stationError } = await supabase
        .from('station')
        .select('*')
        .eq('id', stationId)
        .single()

      if (stationError) throw stationError
      setStation(stationData)

      // Load statuses
      const { data: statusData, error: statusError } = await supabase
        .from('station_status')
        .select('*')
        .eq('station_id', stationId)
        .order('updated_at', { ascending: false })

      if (statusError) throw statusError
      setStatuses(statusData || [])
    } catch (err) {
      console.error('Error loading station:', err)
      showToast('error', 'Erreur lors du chargement des données')
    }
  }

  function subscribeToUpdates() {
    const channel = supabase
      .channel(`trusted-station-${stationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'station_status',
          filter: `station_id=eq.${stationId}`,
        },
        () => {
          loadStationData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function handleFuelStatusSelection(fuelType: FuelType, status: Availability) {
    setSelectedStatuses((prev) => ({
      ...prev,
      [fuelType]: prev[fuelType] === status ? null : status,
    }))
  }

  function formatQueueDisplay(hours: number | null, touched: boolean) {
    if (!touched || hours === null) return 'Non renseigné'
    if (hours === 0) return '0 min'
    if (hours >= 12) return '12 h +'

    const totalMinutes = Math.round(hours * 60)
    if (totalMinutes < 60) {
      return `${totalMinutes} min`
    }

    const wholeHours = Math.floor(hours)
    const remainingMinutes = Math.round((hours - wholeHours) * 60)

    if (remainingMinutes === 0) {
      return `${wholeHours} h`
    }

    return `${wholeHours} h ${remainingMinutes} min`
  }

  function handleQueueSliderChange(value: number) {
    setQueueTouched(true)
    setQueueHours(value)

    const minutes = value * 60
    let queueCategory: string | null

    if (minutes <= 10) queueCategory = 'Q_0_10'
    else if (minutes <= 30) queueCategory = 'Q_10_30'
    else if (minutes <= 60) queueCategory = 'Q_30_60'
    else queueCategory = 'Q_60_PLUS'

    setSelectedQueue(queueCategory)
  }

  function resetQueueSelection() {
    setQueueTouched(false)
    setQueueHours(null)
    setSelectedQueue(null)
  }

  function handleSubmitContribution() {
    const selectedStatusEntries = (Object.entries(selectedStatuses) as [FuelType, Availability | null][])
      .filter(([, status]) => status !== null) as [FuelType, Availability][]

    if (selectedStatusEntries.length === 0 && !selectedQueue) {
      showToast('warning', 'Sélectionnez au moins un statut carburant ou une file d\'attente.')
      return
    }

    setShowConfirmDialog(true)
  }

  async function performSubmit() {
    setShowConfirmDialog(false)
    setSubmitting(true)

    try {
      if (!station) return

      const selectedStatusEntries = (Object.entries(selectedStatuses) as [FuelType, Availability | null][])
        .filter(([, status]) => status !== null) as [FuelType, Availability][]

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from('user_profile')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      // Create TRUSTED contribution(s)
      const hasStatusUpdates = selectedStatusEntries.length > 0
      const contributionPayloads = hasStatusUpdates
        ? selectedStatusEntries.map(([_, status], index) => ({
            station_id: stationId,
            user_id: profile?.id || null,
            source_type: 'TRUSTED' as const,
            queue_category: index === 0 ? (selectedQueue as any) : null,
            fuel_status: status as any,
          }))
        : [
            {
              station_id: stationId,
              user_id: profile?.id || null,
              source_type: 'TRUSTED' as const,
              queue_category: selectedQueue as any,
              fuel_status: null,
            },
          ]

      const { error: contribError } = await supabase.from('contribution').insert(contributionPayloads)

      if (contribError) throw contribError

      // Update or create station status if fuel status is provided
      if (hasStatusUpdates) {
        for (const [fuelType, fuelStatus] of selectedStatusEntries) {
          const existingStatus = statuses.find((s) => s.fuel_type === fuelType)

          if (existingStatus) {
            const { error: updateError } = await supabase
              .from('station_status')
              .update({
                availability: fuelStatus as any,
                last_update_source: 'TRUSTED',
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingStatus.id)

            if (updateError) throw updateError
          } else {
            const { error: insertError } = await supabase.from('station_status').insert({
              station_id: stationId,
              fuel_type: fuelType,
              availability: fuelStatus as any,
              last_update_source: 'TRUSTED',
            })

            if (insertError) throw insertError
          }
        }

        // Recompute waiting time and reliability via API
        const recomputeResponse = await fetch('/api/recompute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: stationId }),
        })

        if (!recomputeResponse.ok) {
          const recomputePayload = await recomputeResponse.json().catch(() => ({}))
          throw new Error(recomputePayload.error || 'Recompute API error')
        }
      }

      // Reset form
      setSelectedQueue(null)
      setSelectedStatuses({
        ESSENCE: null,
        GASOIL: null,
      })
      setQueueHours(null)
      setQueueTouched(false)

      // Reload data
      await loadStationData()

      showToast('success', 'Rapport vérifié envoyé avec succès !')
    } catch (err) {
      console.error('Error submitting contribution:', err)
      showToast('error', `Erreur lors de l'envoi: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setSubmitting(false)
    }
  }

  function openInMaps() {
    if (!station) return
    const url = `https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`
    window.open(url, '_blank')
  }

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

  if (!station) {
    return (
      <div className="min-h-screen bg-gray-900">
        <EmptyState
          icon="📍"
          title="Station non trouvée"
          description="Cette station n'existe pas ou n'est plus active."
          actionLabel="Retour"
          onAction={() => router.push('/trusted')}
        />
      </div>
    )
  }

  const essenceStatus = statuses.find((s) => s.fuel_type === 'ESSENCE')
  const gasoilStatus = statuses.find((s) => s.fuel_type === 'GASOIL')

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        title="Confirmer le rapport vérifié"
        message={`Voulez-vous vraiment envoyer ce rapport vérifié pour ${station.name} ?`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onConfirm={performSubmit}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {/* Header - Premium */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 shadow-xl border-b-2 border-gray-700">
        <div className="px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => router.push('/trusted')} 
            className="text-white hover:text-gray-300 transition-all hover:scale-110 active:scale-95"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{station.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-primary-teal/20 border border-primary-teal text-primary-teal text-xs font-bold rounded-full">
                ✓ RAPPORTEUR VÉRIFIÉ
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Station Info - Premium */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all">
          <div className="flex items-start justify-between mb-3 gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{station.name}</h2>
              {station.brand && <p className="text-gray-300 mb-1">{station.brand}</p>}
              <p className="text-gray-400 text-sm">{station.neighborhood}, {station.municipality}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-4">
              {([
                { label: 'E', status: essenceStatus?.availability ?? null },
                { label: 'G', status: gasoilStatus?.availability ?? null },
              ] as { label: string; status: Availability | null }[]).map(({ label, status }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <FuelStatusIcon status={status ?? null} size={44} />
                  <span className="px-2 py-0.5 rounded-full bg-gray-800/80 border border-gray-700 text-xs font-semibold text-gray-200">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" fullWidth onClick={openInMaps} className="mt-3 hover-glow transition-all">
            OUVRIR DANS MAPS
          </Button>
        </Card>

        {/* Fuel Status - Premium */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-white">STATUT DU CARBURANT</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-teal rounded-full animate-pulse-slow"></div>
              <span className="text-xs text-gray-400">En direct</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-700/60 rounded-xl border border-gray-600 gap-3 hover-lift transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <FuelStatusIcon status={essenceStatus?.availability ?? null} size={48} />
                  {essenceStatus && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-teal rounded-full border-2 border-gray-800"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-base">Essence</div>
                  {essenceStatus && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(essenceStatus.updated_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  {essenceStatus
                    ? getAvailabilityLabel(essenceStatus.availability)
                    : 'Inconnu'}
                </div>
                {essenceStatus?.waiting_time_min !== null && essenceStatus?.waiting_time_max !== null && (
                  <div className="text-xs text-gray-400 mt-1">
                    {essenceStatus.waiting_time_min}-{essenceStatus.waiting_time_max} min
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700/60 rounded-xl border border-gray-600 gap-3 hover-lift transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <FuelStatusIcon status={gasoilStatus?.availability ?? null} size={48} />
                  {gasoilStatus && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-teal rounded-full border-2 border-gray-800"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-base">Gasoil</div>
                  {gasoilStatus && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(gasoilStatus.updated_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  {gasoilStatus
                    ? getAvailabilityLabel(gasoilStatus.availability)
                    : 'Inconnu'}
                </div>
                {gasoilStatus?.waiting_time_min !== null && gasoilStatus?.waiting_time_max !== null && (
                  <div className="text-xs text-gray-400 mt-1">
                    {gasoilStatus.waiting_time_min}-{gasoilStatus.waiting_time_max} min
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Waiting Time */}
          {(essenceStatus || gasoilStatus) && (
            <div className="mt-4 pt-4 border-t-2 border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Temps d'attente estimé:</span>
                <span className="font-bold text-lg text-white">
                  {essenceStatus?.waiting_time_min &&
                  essenceStatus?.waiting_time_max
                    ? `${essenceStatus.waiting_time_min}-${essenceStatus.waiting_time_max} min`
                    : gasoilStatus?.waiting_time_min && gasoilStatus?.waiting_time_max
                    ? `${gasoilStatus.waiting_time_min}-${gasoilStatus.waiting_time_max} min`
                    : 'Non disponible'}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Contribution Form - Premium */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-white">RAPPORT VÉRIFIÉ</h3>
            <span className="px-2 py-0.5 bg-primary-teal/20 border border-primary-teal text-primary-teal text-xs font-bold rounded-full">
              ✓ VÉRIFIÉ
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-5">
            En tant que rapporteur vérifié, vos mises à jour ont un <span className="font-semibold text-primary-teal">poids élevé</span> dans le système et sont visibles immédiatement
          </p>

          <div className="space-y-3">
            <div className="space-y-3">
              {([
                { type: 'ESSENCE' as const, label: 'Essence' },
                { type: 'GASOIL' as const, label: 'Gasoil' },
              ]).map(({ type, label }) => (
                <div key={type} className="bg-gray-700/40 border-2 border-gray-600 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-200">{label}</span>
                    {statuses.find((s) => s.fuel_type === type) && (
                      <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                        Dernier: {getAvailabilityLabel(statuses.find((s) => s.fuel_type === type)?.availability ?? null)}
                      </span>
                    )}
                    {selectedStatuses[type] && (
                      <span className="text-xs text-primary-teal bg-primary-teal/20 px-2 py-1 rounded font-semibold">
                        ✓ Sélectionné
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { status: 'AVAILABLE' as const, caption: 'Disponible', activeClasses: 'bg-green-600 border-green-400 shadow-lg shadow-green-500/50' },
                      { status: 'LIMITED' as const, caption: 'Limité', activeClasses: 'bg-yellow-600 border-yellow-400 shadow-lg shadow-yellow-500/50' },
                      { status: 'OUT' as const, caption: 'Rupture', activeClasses: 'bg-red-600 border-red-400 shadow-lg shadow-red-500/50' },
                    ]).map(({ status, caption, activeClasses }) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleFuelStatusSelection(type, status)}
                        className={`px-3 py-4 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                          selectedStatuses[type] === status
                            ? `${activeClasses} text-white border-2 scale-105 hover:scale-110`
                            : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:scale-[1.02]'
                        }`}
                      >
                        <FuelStatusIcon status={status} size={36} />
                        <span>{caption}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Queue Range Slider - Premium */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-gray-300">
                  File d'attente (0 à 12h+)
                </label>
                {selectedQueue && (
                  <span className="text-xs text-primary-teal bg-primary-teal/20 px-2 py-1 rounded font-semibold">
                    ✓ Sélectionné
                  </span>
                )}
              </div>
              <div className="bg-gray-700/60 border-2 border-gray-600 rounded-xl px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-300">Temps sélectionné</span>
                  <span className="text-sm font-bold text-white">
                    {formatQueueDisplay(queueHours, queueTouched)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.25}
                  value={queueHours ?? 0}
                  onChange={(e) => handleQueueSliderChange(Number(e.target.value))}
                  className="w-full accent-primary-teal h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>0 min</span>
                  <span>12 h+</span>
                </div>
                {queueTouched && (
                  <button
                    type="button"
                    onClick={resetQueueSelection}
                    className="mt-3 text-xs text-gray-400 hover:text-primary-teal underline transition-colors"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={handleSubmitContribution}
              disabled={
                submitting ||
                (!selectedQueue && !Object.values(selectedStatuses).some((status) => status !== null))
              }
              className="mt-4 hover-glow transition-all"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>ENVOI EN COURS...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-xl">✓</span>
                  <span className="font-bold">ENVOYER LE RAPPORT VÉRIFIÉ</span>
                </span>
              )}
            </Button>

            {!selectedQueue && !Object.values(selectedStatuses).some((status) => status !== null) && (
              <p className="text-xs text-center text-gray-400 mt-3">
                ⚠️ Sélectionnez au moins un statut carburant ou une file d'attente
              </p>
            )}

            {(selectedQueue || Object.values(selectedStatuses).some((status) => status !== null)) && (
              <p className="text-xs text-center text-primary-teal mt-3 font-medium">
                ✓ Votre rapport aura un poids élevé dans le système
              </p>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
