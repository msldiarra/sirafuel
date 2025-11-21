'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatTimeAgo, getAvailabilityLabel } from '@/lib/utils'
import { FuelStatusIcon } from '@/components/ui/FuelStatusIcon'
import type { Station, StationStatus, Contribution, FuelType, Availability } from '@/lib/supabase/types'

type StationWithLocation = Station & {
  municipality: string
  neighborhood: string
}

type FeedbackType = 'success' | 'error' | 'info' | 'warning'

type FeedbackMessage = {
  type: FeedbackType
  message: string
}

type SelectedStatuses = Record<FuelType, Availability | null>

const FEEDBACK_STYLES: Record<FeedbackType, string> = {
  success: 'bg-emerald-500/95 border border-emerald-400/70',
  error: 'bg-red-600/95 border border-red-500/70',
  info: 'bg-sky-600/95 border border-sky-500/70',
  warning: 'bg-amber-500/95 border border-amber-400/70',
}

const FEEDBACK_ICONS: Record<FeedbackType, string> = {
  success: '✅',
  error: '⛔',
  info: 'ℹ️',
  warning: '⚠️',
}

export default function StationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const stationId = params.id as string

  const [station, setStation] = useState<StationWithLocation | null>(null)
  const [statuses, setStatuses] = useState<StationStatus[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<SelectedStatuses>({
    ESSENCE: null,
    GASOIL: null,
  })
  const [queueHours, setQueueHours] = useState<number | null>(null)
  const [queueTouched, setQueueTouched] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadStationData()
    subscribeToUpdates()
    return () => {
      clearFeedbackTimer()
    }
  }, [stationId])

  function clearFeedbackTimer() {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }

  function showFeedback(type: FeedbackType, message: string) {
    clearFeedbackTimer()
    setFeedback({ type, message })
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null)
      feedbackTimeoutRef.current = null
    }, 3200)
  }

  function dismissFeedback() {
    clearFeedbackTimer()
    setFeedback(null)
  }

  function handleFuelStatusSelection(fuelType: FuelType, status: Availability) {
    setSelectedStatuses((prev) => ({
      ...prev,
      [fuelType]: prev[fuelType] === status ? null : status,
    }))
  }

  async function loadStationData() {
    try {
      setLoading(true)

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

      // Load recent contributions
      const { data: contribData, error: contribError } = await supabase
        .from('contribution')
        .select('*')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (contribError) throw contribError
      setContributions(contribData || [])
    } catch (err) {
      console.error('Error loading station:', err)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToUpdates() {
    const channel = supabase
      .channel(`station-${stationId}`)
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contribution',
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

  async function handleContribution() {
    const selectedStatusEntries = (Object.entries(selectedStatuses) as [FuelType, Availability | null][])
      .filter(([, status]) => status !== null) as [FuelType, Availability][]

    if (selectedStatusEntries.length === 0 && !selectedQueue) {
      showFeedback('warning', 'Sélectionnez au moins un statut carburant ou une file d’attente.')
      return
    }

    let statusUpdateWarning: string | null = null
    let statusUpdateRejected = false
    let statusUpdateApplied = false

    try {
      setSubmitting(true)

      // Get current user (if any)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let userProfileId: string | null = null
      let userRole: 'PUBLIC' | 'TRUSTED_REPORTER' | 'STATION_MANAGER' | 'ADMIN' | null = null
      if (user) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('id, role')
          .eq('auth_user_id', user.id)
          .single()

        userProfileId = profile?.id || null
        userRole = profile?.role || null
      }

      // Determine source type based on user role
      let sourceType: 'PUBLIC' | 'TRUSTED' | 'OFFICIAL' = 'PUBLIC'
      if (userRole === 'TRUSTED_REPORTER') {
        sourceType = 'TRUSTED'
      } else if (userRole === 'STATION_MANAGER') {
        sourceType = 'OFFICIAL'
      }

      // Create contribution(s)
      const hasStatusUpdates = selectedStatusEntries.length > 0
      const contributionPayloads = hasStatusUpdates
        ? selectedStatusEntries.map(([_, status], index) => ({
            station_id: stationId,
            user_id: userProfileId,
            source_type: sourceType,
            queue_category: index === 0 ? (selectedQueue as any) : null,
            fuel_status: status as any,
          }))
        : [
            {
              station_id: stationId,
              user_id: userProfileId,
              source_type: sourceType,
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
                last_update_source: sourceType,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingStatus.id)

            if (updateError) {
              if ((updateError as any)?.code === '42501') {
                statusUpdateWarning =
                  'Votre signalement est reçu. Les mises à jour officielles seront validées par un rapporteur vérifié.'
                statusUpdateRejected = true
                continue
              }
              throw updateError
            }
            statusUpdateApplied = true
          } else {
            const { error: insertError } = await supabase.from('station_status').insert({
              station_id: stationId,
              fuel_type: fuelType,
              availability: fuelStatus as any,
              last_update_source: sourceType,
            })

            if (insertError) {
              if ((insertError as any)?.code === '42501') {
                statusUpdateWarning =
                  'Votre signalement est reçu. Les mises à jour officielles seront validées par un rapporteur vérifié.'
                statusUpdateRejected = true
                continue
              }
              throw insertError
            }
            statusUpdateApplied = true
          }
        }

        if (statusUpdateApplied) {
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

        if (statusUpdateWarning && !statusUpdateApplied) {
          // We'll surface the warning within the success message below
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

      let successMessage = 'Merci ! Votre signalement a bien été enregistré.'
      if (statusUpdateRejected) {
        successMessage = statusUpdateApplied
          ? 'Merci ! Vos statuts sont envoyés. Certaines mises à jour officielles nécessitent une validation.'
          : statusUpdateWarning || successMessage
      }

      showFeedback('success', successMessage)
    } catch (err) {
      console.error('Error submitting contribution:', err)
      showFeedback('error', "Erreur lors de l'envoi de votre contribution.")
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
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-gray-900">
        <EmptyState
          icon="⛽"
          title="Station introuvable"
          description="Cette station n'existe pas ou a été supprimée."
          actionLabel="Retour à l'accueil"
          onAction={() => router.push('/')}
        />
      </div>
    )
  }

  const essenceStatus = statuses.find((s) => s.fuel_type === 'ESSENCE')
  const gasoilStatus = statuses.find((s) => s.fuel_type === 'GASOIL')

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {feedback && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pointer-events-none">
          <div
            role="alert"
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ${FEEDBACK_STYLES[feedback.type]}`}
          >
            <span className="text-xl leading-none">{FEEDBACK_ICONS[feedback.type]}</span>
            <span className="font-semibold tracking-wide">{feedback.message}</span>
            <button
              onClick={dismissFeedback}
              className="ml-3 text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 text-white sticky top-0 z-40 shadow-lg border-b-2 border-gray-700">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white hover:text-gray-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold flex-1">{station.name}</h1>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Station Info */}
        <Card className="mb-4 p-4">
          <div className="flex items-start justify-between mb-3 gap-4">
            <div>
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

          <Button variant="primary" fullWidth onClick={openInMaps} className="mt-3">
            OUVRIR DANS MAPS
          </Button>
        </Card>

        {/* Fuel Status */}
        <Card className="mb-4 p-4">
          <h3 className="font-bold text-lg mb-3 text-white">STATUT DU CARBURANT</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600 gap-3">
              <div className="flex items-center gap-3">
                <FuelStatusIcon status={essenceStatus?.availability ?? null} size={44} />
                <div>
                  <div className="font-semibold text-white">Essence</div>
                  {essenceStatus && (
                    <div className="text-sm text-gray-400">
                      Mis à jour {formatTimeAgo(essenceStatus.updated_at)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-white text-right min-w-[96px]">
                {essenceStatus
                  ? getAvailabilityLabel(essenceStatus.availability)
                  : 'Inconnu'}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600 gap-3">
              <div className="flex items-center gap-3">
                <FuelStatusIcon status={gasoilStatus?.availability ?? null} size={44} />
                <div>
                  <div className="font-semibold text-white">Gasoil</div>
                  {gasoilStatus && (
                    <div className="text-sm text-gray-400">
                      Mis à jour {formatTimeAgo(gasoilStatus.updated_at)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-white text-right min-w-[96px]">
                {gasoilStatus
                  ? getAvailabilityLabel(gasoilStatus.availability)
                  : 'Inconnu'}
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

        {/* Contribution Form */}
        <Card className="mb-4 p-4">
          <h3 className="font-bold text-lg mb-3 text-white">CONTRIBUER</h3>
          <p className="text-sm text-gray-400 mb-4">
            Partagez l'état actuel de la station pour aider la communauté
          </p>

          <div className="space-y-3">
            <div className="space-y-3">
              {([
                { type: 'ESSENCE' as const, label: 'Essence' },
                { type: 'GASOIL' as const, label: 'Gasoil' },
              ]).map(({ type, label }) => (
                <div key={type} className="bg-gray-700/40 border border-gray-600 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-200">{label}</span>
                    {statuses.find((s) => s.fuel_type === type) && (
                      <span className="text-xs text-gray-400">
                        Dernier: {getAvailabilityLabel(statuses.find((s) => s.fuel_type === type)?.availability ?? null)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { status: 'AVAILABLE' as const, caption: 'Disponible', activeClasses: 'bg-green-600 border-green-500' },
                      { status: 'LIMITED' as const, caption: 'Limité', activeClasses: 'bg-yellow-600 border-yellow-500' },
                      { status: 'OUT' as const, caption: 'Rupture', activeClasses: 'bg-red-600 border-red-500' },
                    ]).map(({ status, caption, activeClasses }) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleFuelStatusSelection(type, status)}
                        className={`px-3 py-3 rounded-lg text-sm font-semibold transition-colors flex flex-col items-center justify-center gap-2 ${
                          selectedStatuses[type] === status
                            ? `${activeClasses} text-white border-2`
                            : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                        }`}
                      >
                        <FuelStatusIcon status={status} size={40} />
                        <span>{caption}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Queue Range Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                File d'attente (0 à 12h+)
              </label>
              <div className="bg-gray-700/60 border border-gray-600 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-300">Temps sélectionné</span>
                  <span className="text-sm font-semibold text-white">
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
                  className="w-full accent-primary-teal"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>0 min</span>
                  <span>12 h+</span>
                </div>
                {queueTouched && (
                  <button
                    type="button"
                    onClick={resetQueueSelection}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-200 underline"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={handleContribution}
              disabled={
                submitting ||
                (!selectedQueue && !Object.values(selectedStatuses).some((status) => status !== null))
              }
              className="mt-4"
            >
              {submitting ? 'Envoi...' : 'ENVOYER LA CONTRIBUTION'}
            </Button>
          </div>
        </Card>

        {/* Recent Updates */}
        {(essenceStatus || gasoilStatus || contributions.length > 0) && (
          <Card className="mb-4 p-4 space-y-4">
            <div>
              <h3 className="font-bold text-lg text-white">DERNIÈRES MISES À JOUR</h3>
              <p className="text-xs uppercase tracking-wide text-gray-500">Statut par carburant</p>
            </div>

            {[{ label: 'Essence', status: essenceStatus }, { label: 'Gasoil', status: gasoilStatus }].map(({ label, status }) => (
              <div
                key={label}
                className="flex items-center justify-between bg-gray-700 rounded-lg border border-gray-600 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="text-base font-semibold text-white">
                    {status ? getAvailabilityLabel(status.availability) : 'Aucune mise à jour'}
                  </p>
                </div>
                <div className="text-right">
                  {status ? (
                    <p className="text-xs text-gray-400">Mis à jour {formatTimeAgo(status.updated_at)}</p>
                  ) : (
                    <p className="text-xs text-gray-500">—</p>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  )
}

