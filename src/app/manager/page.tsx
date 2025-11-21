'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FuelStatusIcon } from '@/components/ui/FuelStatusIcon'
import { Toast, ToastContainer, type ToastType } from '@/components/ui/Toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import type { Station, StationStatus, Availability } from '@/lib/supabase/types'
import { RealtimeChannel } from '@supabase/supabase-js'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export default function ManagerPage() {
  const router = useRouter()
  const [station, setStation] = useState<Station | null>(null)
  const [statuses, setStatuses] = useState<StationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<(() => void) | null>(null)
  const [essenceStatus, setEssenceStatus] = useState<Availability>('AVAILABLE')
  const [gasoilStatus, setGasoilStatus] = useState<Availability>('AVAILABLE')
  const [waitingTimeMin, setWaitingTimeMin] = useState<number | null>(null)
  const [waitingTimeMax, setWaitingTimeMax] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [showWeightInfo, setShowWeightInfo] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

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
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check if form has changes
    const essenceCurrent = statuses.find((s) => s.fuel_type === 'ESSENCE')?.availability
    const gasoilCurrent = statuses.find((s) => s.fuel_type === 'GASOIL')?.availability
    const waitingTimeMinCurrent = statuses.find((s) => s.fuel_type === 'ESSENCE')?.waiting_time_min ?? 
                                  statuses.find((s) => s.fuel_type === 'GASOIL')?.waiting_time_min ?? null
    const waitingTimeMaxCurrent = statuses.find((s) => s.fuel_type === 'ESSENCE')?.waiting_time_max ?? 
                                  statuses.find((s) => s.fuel_type === 'GASOIL')?.waiting_time_max ?? null

    const hasStatusChanges = 
      (essenceCurrent && essenceStatus !== essenceCurrent) ||
      (gasoilCurrent && gasoilStatus !== gasoilCurrent) ||
      waitingTimeMin !== waitingTimeMinCurrent ||
      waitingTimeMax !== waitingTimeMaxCurrent

    setHasChanges(hasStatusChanges || (!essenceCurrent && !gasoilCurrent))
  }, [essenceStatus, gasoilStatus, waitingTimeMin, waitingTimeMax, statuses])

  async function checkAuthAndLoadStation() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile || profile.role !== 'STATION_MANAGER' || !profile.station_id) {
        router.push('/')
        return
      }

      // Load station
      const { data: stationData } = await supabase
        .from('station')
        .select('*')
        .eq('id', profile.station_id)
        .single()

      setStation(stationData)

      // Load current statuses
      await loadStatuses(profile.station_id)

      // Subscribe to real-time updates
      subscribeToRealtimeUpdates(profile.station_id)
    } catch (err) {
      console.error('Error loading manager data:', err)
      showToast('error', 'Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  async function loadStatuses(stationId: string) {
    const { data: statusesData } = await supabase
      .from('station_status')
      .select('*')
      .eq('station_id', stationId)
      .order('updated_at', { ascending: false })

    if (statusesData) {
      setStatuses(statusesData)
      const essence = statusesData.find((s) => s.fuel_type === 'ESSENCE')
      const gasoil = statusesData.find((s) => s.fuel_type === 'GASOIL')

      setEssenceStatus(essence?.availability || 'AVAILABLE')
      setGasoilStatus(gasoil?.availability || 'AVAILABLE')

      setWaitingTimeMin(essence?.waiting_time_min ?? gasoil?.waiting_time_min ?? null)
      setWaitingTimeMax(essence?.waiting_time_max ?? gasoil?.waiting_time_max ?? null)

      if (essence || gasoil) {
        const latestUpdate = essence?.updated_at || gasoil?.updated_at
        if (latestUpdate) {
          setLastUpdateTime(new Date(latestUpdate))
        }
      }
    }
  }

  function subscribeToRealtimeUpdates(stationId: string) {
    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Subscribe to station_status changes for this station
    const channel = supabase
      .channel(`station-status-${stationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'station_status',
          filter: `station_id=eq.${stationId}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          // Reload statuses to get latest data
          loadStatuses(stationId)
          
          // Show notification if update came from another source
          if (payload.eventType === 'UPDATE' && payload.new.last_update_source !== 'OFFICIAL') {
            showToast('info', 'Mise à jour détectée depuis une autre source')
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Show confirmation dialog if there are significant changes
    if (hasChanges) {
      setPendingUpdate(() => () => performUpdate())
      setShowConfirmDialog(true)
      return
    }

    performUpdate()
  }

  async function performUpdate() {
    setShowConfirmDialog(false)
    setSubmitting(true)

    try {
      if (!station) return

      // Validate waiting time
      if (waitingTimeMin !== null && waitingTimeMax !== null && waitingTimeMin > waitingTimeMax) {
        showToast('error', 'Le temps minimum doit être inférieur ou égal au temps maximum')
        setSubmitting(false)
        return
      }

      const updateResults: { fuelType: string; success: boolean; error?: string }[] = []

      // Update or create statuses for both fuel types
      for (const fuelType of ['ESSENCE', 'GASOIL'] as const) {
        const availability = fuelType === 'ESSENCE' ? essenceStatus : gasoilStatus

        try {
          // Check if status exists
          const { data: existing, error: selectError } = await supabase
            .from('station_status')
            .select('id')
            .eq('station_id', station.id)
            .eq('fuel_type', fuelType)
            .maybeSingle()

          if (selectError) {
            updateResults.push({
              fuelType,
              success: false,
              error: `Erreur de vérification: ${selectError.message}`,
            })
            continue
          }

          // Update or insert
          if (existing) {
            const { error: updateError } = await supabase
              .from('station_status')
              .update({
                availability,
                waiting_time_min: waitingTimeMin,
                waiting_time_max: waitingTimeMax,
                last_update_source: 'OFFICIAL',
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)

            if (updateError) {
              updateResults.push({
                fuelType,
                success: false,
                error: `Erreur de mise à jour: ${updateError.message}`,
              })
              continue
            }
          } else {
            const { error: insertError } = await supabase.from('station_status').insert({
              station_id: station.id,
              fuel_type: fuelType,
              availability,
              waiting_time_min: waitingTimeMin,
              waiting_time_max: waitingTimeMax,
              last_update_source: 'OFFICIAL',
            })

            if (insertError) {
              updateResults.push({
                fuelType,
                success: false,
                error: `Erreur d'insertion: ${insertError.message}`,
              })
              continue
            }
          }

          // Create contribution
          await supabase.from('contribution').insert({
            station_id: station.id,
            source_type: 'OFFICIAL',
            fuel_status: availability,
          })

          updateResults.push({ fuelType, success: true })
        } catch (err) {
          updateResults.push({
            fuelType,
            success: false,
            error: `Erreur inattendue: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
      }

      // Check results and provide feedback
      const successCount = updateResults.filter((r) => r.success).length
      const failedUpdates = updateResults.filter((r) => !r.success)

      if (successCount === 2) {
        showToast('success', 'Mise à jour envoyée avec succès pour Essence et Gasoil !')
        setLastUpdateTime(new Date())
      } else if (successCount === 1) {
        const successFuel = updateResults.find((r) => r.success)?.fuelType
        const failedFuel = failedUpdates[0]
        showToast(
          'warning',
          `Seul ${successFuel} a été mis à jour. Erreur pour ${failedFuel.fuelType}: ${failedFuel.error}`
        )
      } else {
        const errorMessages = failedUpdates.map((f) => `${f.fuelType}: ${f.error}`).join(' | ')
        showToast('error', `Échec de mise à jour: ${errorMessages}`)
      }

      await loadStatuses(station.id)
    } catch (err) {
      console.error('Error submitting update:', err)
      showToast('error', `Erreur générale: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setSubmitting(false)
    }
  }

  function getTimeAgo(date: Date | null): string {
    if (!date) return 'Jamais'
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Il y a ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `Il y a ${diffDays}j`
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
          icon="⛽"
          title="Aucune station assignée"
          description="Vous n'avez pas de station assignée. Contactez un administrateur."
          actionLabel="Retour à l'accueil"
          onAction={() => router.push('/')}
        />
      </div>
    )
  }

  const essenceCurrent = statuses.find((s) => s.fuel_type === 'ESSENCE')
  const gasoilCurrent = statuses.find((s) => s.fuel_type === 'GASOIL')

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        title="Confirmer la mise à jour"
        message="Voulez-vous vraiment mettre à jour le statut de la station ? Cette action aura un poids maximal et sera visible immédiatement par tous les utilisateurs."
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onConfirm={() => {
          if (pendingUpdate) {
            pendingUpdate()
            setPendingUpdate(null)
          }
        }}
        onCancel={() => {
          setShowConfirmDialog(false)
          setPendingUpdate(null)
        }}
      />

      {/* Info Popup for Weight Explanation */}
      {showWeightInfo && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowWeightInfo(false)}
        >
            <Card
              className="bg-gray-800 rounded-2xl shadow-2xl border-2 border-gray-700 max-w-md w-full p-6 animate-scale-in"
              onClick={(e?: React.MouseEvent<HTMLDivElement>) => e?.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                Poids Maximal
              </h3>
              <button
                onClick={() => setShowWeightInfo(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="text-sm leading-relaxed">
                En tant que <span className="font-semibold text-white">gestionnaire de station</span>, vos mises à jour ont le <span className="font-semibold text-primary-teal">poids maximal</span> dans le système.
              </p>
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-white mb-2">Cela signifie :</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-teal mt-0.5">✓</span>
                    <span>Vos mises à jour ont la <strong>priorité la plus élevée</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-teal mt-0.5">✓</span>
                    <span>Elles sont <strong>visibles immédiatement</strong> par tous les utilisateurs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-teal mt-0.5">✓</span>
                    <span>Elles <strong>écrasent</strong> les mises à jour publiques ou vérifiées</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-teal mt-0.5">✓</span>
                    <span>Elles sont marquées comme <strong>OFFICIELLES</strong> dans le système</span>
                  </li>
                </ul>
              </div>
              <p className="text-xs text-gray-400 italic">
                Utilisez cette fonctionnalité avec responsabilité pour garantir des informations précises et à jour.
              </p>
            </div>
            <div className="mt-6">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setShowWeightInfo(false)}
              >
                Compris
              </Button>
            </div>
          </Card>
        </div>
      )}

      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 shadow-xl border-b-2 border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold">Gestionnaire de Station</h1>
            {lastUpdateTime && (
              <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                {getTimeAgo(lastUpdateTime)}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-300">{station.name}</p>
          {station.brand && (
            <p className="text-xs text-gray-400 mt-1">{station.brand}</p>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Current Station Status */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-white">STATUT ACTUEL</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-slow"></div>
              <span className="text-xs text-gray-400">En direct</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-700/60 rounded-xl border border-gray-600 gap-3 hover-lift transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <FuelStatusIcon
                    status={essenceCurrent?.availability ?? null}
                    size={48}
                  />
                  {essenceCurrent && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-teal rounded-full border-2 border-gray-800"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-base">Essence</div>
                  {essenceCurrent && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(essenceCurrent.updated_at).toLocaleString('fr-FR', {
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
                  {essenceCurrent?.availability === 'AVAILABLE' && 'Disponible'}
                  {essenceCurrent?.availability === 'LIMITED' && 'Limité'}
                  {essenceCurrent?.availability === 'OUT' && 'Rupture'}
                  {!essenceCurrent && 'Inconnu'}
                </div>
                {essenceCurrent?.waiting_time_min !== null && essenceCurrent?.waiting_time_max !== null && (
                  <div className="text-xs text-gray-400 mt-1">
                    {essenceCurrent?.waiting_time_min}-{essenceCurrent?.waiting_time_max} min
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700/60 rounded-xl border border-gray-600 gap-3 hover-lift transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <FuelStatusIcon
                    status={gasoilCurrent?.availability ?? null}
                    size={48}
                  />
                  {gasoilCurrent && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-teal rounded-full border-2 border-gray-800"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-base">Gasoil</div>
                  {gasoilCurrent && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(gasoilCurrent.updated_at).toLocaleString('fr-FR', {
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
                  {gasoilCurrent?.availability === 'AVAILABLE' && 'Disponible'}
                  {gasoilCurrent?.availability === 'LIMITED' && 'Limité'}
                  {gasoilCurrent?.availability === 'OUT' && 'Rupture'}
                  {!gasoilCurrent && 'Inconnu'}
                </div>
                {gasoilCurrent?.waiting_time_min !== null && gasoilCurrent?.waiting_time_max !== null && (
                  <div className="text-xs text-gray-400 mt-1">
                    {gasoilCurrent?.waiting_time_min}-{gasoilCurrent?.waiting_time_max} min
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Update Form */}
        <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg text-white">MISE À JOUR OFFICIELLE</h2>
            <button
              onClick={() => setShowWeightInfo(true)}
              className="w-6 h-6 bg-primary-teal hover:bg-teal-600 text-white text-sm font-bold rounded-full shadow-lg flex items-center justify-center transition-colors"
              aria-label="En savoir plus sur le poids maximal"
            >
              ?
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-5">
            En tant que gestionnaire, vos mises à jour ont la priorité maximale et sont visibles immédiatement
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Essence Status Buttons */}
            <div className="bg-gray-700/40 border-2 border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-200">Essence</span>
                {essenceCurrent && (
                  <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                    Actuel: {essenceCurrent.availability === 'AVAILABLE' && 'Disponible'}
                    {essenceCurrent.availability === 'LIMITED' && 'Limité'}
                    {essenceCurrent.availability === 'OUT' && 'Rupture'}
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
                    onClick={() => setEssenceStatus(status)}
                    className={`px-3 py-4 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                      essenceStatus === status
                        ? `${activeClasses} text-white border-2 scale-105`
                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:scale-[1.02]'
                    }`}
                  >
                    <FuelStatusIcon status={status} size={36} />
                    <span>{caption}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gasoil Status Buttons */}
            <div className="bg-gray-700/40 border-2 border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-200">Gasoil</span>
                {gasoilCurrent && (
                  <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                    Actuel: {gasoilCurrent.availability === 'AVAILABLE' && 'Disponible'}
                    {gasoilCurrent.availability === 'LIMITED' && 'Limité'}
                    {gasoilCurrent.availability === 'OUT' && 'Rupture'}
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
                    onClick={() => setGasoilStatus(status)}
                    className={`px-3 py-4 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                      gasoilStatus === status
                        ? `${activeClasses} text-white border-2 scale-105`
                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:scale-[1.02]'
                    }`}
                  >
                    <FuelStatusIcon status={status} size={36} />
                    <span>{caption}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Waiting Time */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-3">
                Temps d&apos;attente estimé (en minutes)
              </label>
              <div className="bg-gray-700/60 border-2 border-gray-600 rounded-xl px-4 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Minimum</label>
                    <input
                      type="number"
                      min="0"
                      max="720"
                      step="1"
                      value={waitingTimeMin ?? ''}
                      onChange={(e) => setWaitingTimeMin(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-500 text-center font-semibold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Maximum</label>
                    <input
                      type="number"
                      min="0"
                      max="720"
                      step="1"
                      value={waitingTimeMax ?? ''}
                      onChange={(e) => setWaitingTimeMax(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal placeholder-gray-500 text-center font-semibold transition-all"
                    />
                  </div>
                </div>
                {(waitingTimeMin !== null || waitingTimeMax !== null) && (
                  <div className="text-center pt-2 border-t border-gray-600">
                    <span className="text-sm font-semibold text-gray-300">
                      Temps d&apos;attente: {waitingTimeMin ?? '?'}-{waitingTimeMax ?? '?'} min
                    </span>
                  </div>
                )}
                {(waitingTimeMin !== null || waitingTimeMax !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingTimeMin(null)
                      setWaitingTimeMax(null)
                    }}
                    className="w-full text-xs text-gray-400 hover:text-gray-200 underline transition-colors"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={submitting || !hasChanges}
              className={`${hasChanges ? 'hover-glow' : ''} transition-all duration-200 ${
                submitting ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  MISE À JOUR EN COURS...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-lg">✓</span>
                  CONFIRMER LA MISE À JOUR OFFICIELLE
                </span>
              )}
            </Button>

            {!hasChanges && (
              <p className="text-xs text-center text-gray-500">
                Aucun changement détecté
              </p>
            )}
          </form>
        </Card>
      </main>
    </div>
  )
}
