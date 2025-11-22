'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toast, ToastContainer, type ToastType } from '@/components/ui/Toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { formatTimeAgo, getAvailabilityIcon, getAvailabilityLabel, getReliabilityLabel } from '@/lib/utils'
import { AdminBottomNav } from '@/components/ui/AdminBottomNav'
import { FuelStatusIcon } from '@/components/ui/FuelStatusIcon'
import { WaitTimeTrendsChart } from '@/components/ui/WaitTimeTrendsChart'
import { Notifications } from '@/components/ui/Notifications'
import type { Station, StationStatus, Alert, UserProfile } from '@/lib/supabase/types'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'overview' | 'stations' | 'alerts' | 'users'>('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalStations: 0,
    stationsWithFuel: 0,
    stationsOut: 0,
    avgWaitingTime: 0,
    peakWaitingTime: 0,
    stationsNoUpdate: 0,
    contributionsLast2h: 0,
    fuelPercentageChange: 0, // vs yesterday
  })
  const [stations, setStations] = useState<(Station & { statuses?: StationStatus[] })[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showImportCSV, setShowImportCSV] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', role: 'TRUSTED_REPORTER', station_id: '', password: '' })
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [csvContent, setCsvContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateStation, setShowCreateStation] = useState(false)
  const [newStation, setNewStation] = useState({
    name: '',
    brand: '',
    municipality: '',
    neighborhood: '',
    latitude: '',
    longitude: '',
    googleMapsUrl: '',
  })
  const [creatingStation, setCreatingStation] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const supabase = createClient()

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Function to parse Google Maps URL and extract coordinates/name
  async function parseGoogleMapsUrl(url: string, showToastCallback?: (type: ToastType, message: string) => void): Promise<{ lat: number | null; lng: number | null; name: string | null }> {
    try {
      // maps.app.goo.gl short links are not supported
      if (url.includes('maps.app.goo.gl')) {
        if (showToastCallback) {
          showToastCallback('error', '❌ Lien raccourci non supporté. Sur Google Maps web (navigateur): cherchez la station → copiez l\'URL depuis la barre d\'adresse.')
        }
        return { lat: null, lng: null, name: null }
      }

      // Format 1: https://www.google.com/maps/place/Name/@lat,lng,zoom
      const placeMatch = url.match(/\/place\/([^/@]+)\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      if (placeMatch) {
        const name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        const lat = parseFloat(placeMatch[2])
        const lng = parseFloat(placeMatch[3])
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, name }
        }
      }

      // Format 2: https://www.google.com/maps/@lat,lng,zoom (mobile/desktop view)
      const atMatch = url.match(/\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      if (atMatch) {
        const lat = parseFloat(atMatch[1])
        const lng = parseFloat(atMatch[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, name: null }
        }
      }

      // Format 3: https://maps.google.com/?q=lat,lng or ?q=name+at+lat,lng
      const qMatch = url.match(/[?&]q=([^&]+)/)
      if (qMatch) {
        const q = decodeURIComponent(qMatch[1])
        const coordsMatch = q.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/)
        if (coordsMatch) {
          const lat = parseFloat(coordsMatch[1])
          const lng = parseFloat(coordsMatch[2])
          if (!isNaN(lat) && !isNaN(lng)) {
            const nameMatch = q.match(/^(.+?)(?:\s+at\s+|\s*@\s*|$)/)
            const name = nameMatch ? nameMatch[1].trim() : null
            return { lat, lng, name }
          }
        }
      }

      // Format 4: https://www.google.com/maps/search/?api=1&query=lat,lng
      const queryMatch = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      if (queryMatch) {
        const lat = parseFloat(queryMatch[1])
        const lng = parseFloat(queryMatch[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, name: null }
        }
      }
    } catch (err) {
      console.error('Error parsing Google Maps URL:', err)
    }
    return { lat: null, lng: null, name: null }
  }


  async function handleGoogleMapsUrlChange(url: string) {
    setNewStation((prev) => ({ ...prev, googleMapsUrl: url }))
    if (url.trim()) {
      try {
        const parsed = await parseGoogleMapsUrl(url, showToast)
        if (parsed.lat && parsed.lng) {
          setNewStation((prev) => ({
            ...prev,
            googleMapsUrl: url,
            latitude: parsed.lat!.toString(),
            longitude: parsed.lng!.toString(),
            name: parsed.name || prev.name,
          }))
          showToast('success', 'Coordonnées extraites depuis Google Maps !')
        } else if (url.length > 20 && !url.includes('goo.gl') && !url.includes('maps.app')) {
          // Only show warning if URL seems complete and not a short link
            showToast('warning', 'Format de lien non reconnu. Assurez-vous d&apos;avoir copié un lien Google Maps valide.')
        }
      } catch (err) {
        console.error('Error processing Google Maps URL:', err)
        showToast('error', 'Erreur lors du traitement du lien. Vérifiez le format.')
      }
    }
  }

  useEffect(() => {
    checkAuthAndLoadData()
    const unsubscribe = subscribeToUpdates()
    return unsubscribe
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuthAndLoadData() {
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

      if (!profile || profile.role !== 'ADMIN') {
        router.push('/')
        return
      }

      await loadData()
    } catch (err) {
      console.error('Error loading admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    // Load stats and stations
    const { data: allStations } = await supabase
      .from('station')
      .select('*')
      .eq('is_active', true)

    setStations(allStations || [])

    const { data: allStatuses } = await supabase.from('station_status').select('*')

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: recentContributions } = await supabase
      .from('contribution')
      .select('id')
      .gte('created_at', twoHoursAgo)

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const stationsWithStatus = await Promise.all(
      (allStations || []).map(async (station) => {
        const { data: statuses } = await supabase
          .from('station_status')
          .select('*')
          .eq('station_id', station.id)
          .order('updated_at', { ascending: false })

        return { ...station, statuses: statuses || [] }
      })
    )

    const stationsWithFuel = stationsWithStatus.filter(
      (s) => s.statuses?.some((st: StationStatus) => st.availability === 'AVAILABLE')
    ).length
    const stationsOut = stationsWithStatus.filter(
      (s) => s.statuses?.some((st: StationStatus) => st.availability === 'OUT')
    ).length

    const waitingTimes = (allStatuses || [])
      .map((s) => s.waiting_time_max)
      .filter((t): t is number => t !== null)
    const avgWaitingTime =
      waitingTimes.length > 0
        ? Math.round(waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length)
        : 0
    const peakWaitingTime = waitingTimes.length > 0 ? Math.max(...waitingTimes) : 0

    const stationsNoUpdate = stationsWithStatus.filter(
      (s) => !s.statuses || s.statuses.length === 0 || s.statuses.every((st: StationStatus) => new Date(st.updated_at) < new Date(oneHourAgo))
    ).length

    // Calculate percentage change vs yesterday (stations with fuel)
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const yesterdayStart = new Date(yesterdayDate)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterdayDate)
    yesterdayEnd.setHours(23, 59, 59, 999)
    
    const { data: yesterdayStatuses } = await supabase
      .from('station_status')
      .select('station_id, availability')
      .gte('updated_at', yesterdayStart.toISOString())
      .lte('updated_at', yesterdayEnd.toISOString())
    
    const yesterdayStationsWithFuel = new Set(
      (yesterdayStatuses || [])
        .filter((s) => s.availability === 'AVAILABLE')
        .map((s) => s.station_id)
    ).size
    
    const fuelPercentageChange = yesterdayStationsWithFuel > 0
      ? Math.round(((stationsWithFuel - yesterdayStationsWithFuel) / yesterdayStationsWithFuel) * 100)
      : 0

    setStats({
      totalStations: allStations?.length || 0,
      stationsWithFuel,
      stationsOut,
      avgWaitingTime,
      peakWaitingTime,
      stationsNoUpdate,
      contributionsLast2h: recentContributions?.length || 0,
      fuelPercentageChange,
    })

    if (activeTab === 'stations') {
      setStations(stationsWithStatus)
    }

    if (activeTab === 'alerts') {
      const { data: alertsData } = await supabase
        .from('alert')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })

      setAlerts(alertsData || [])
    }

    if (activeTab === 'users') {
      const { data: usersData } = await supabase
        .from('user_profile')
        .select('*')
        .order('created_at', { ascending: false })

      setUsers(usersData || [])
    }
  }

  function subscribeToUpdates() {
    const channel = supabase
      .channel('admin-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'station_status',
        },
        () => {
          loadData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alert',
        },
        () => {
          if (activeTab === 'alerts') loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function resolveAlert(alertId: string) {
    await supabase
      .from('alert')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
      .eq('id', alertId)

    await loadData()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleCreateUser() {
    if (!newUser.email || !newUser.role) {
      alert('Email et rôle sont requis')
      return
    }

    try {
      setCreating(true)
      setCreatedPassword(null)
      
      // Get the session token to send in headers
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Session expirée. Veuillez vous reconnecter.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          users: [{
            email: newUser.email,
            role: newUser.role,
            station_id: newUser.station_id || null,
            password: newUser.password || undefined, // Send password if provided
          }],
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.results[0].success) {
        const password = data.results[0].tempPassword || data.results[0].password
        setCreatedPassword(password)
        setNewUser({ email: '', role: 'TRUSTED_REPORTER', station_id: '', password: '' })
        await loadData()
        // Don't close the form immediately so admin can see the password
      } else {
        alert(`Erreur: ${data.results[0].error}`)
      }
    } catch (err: any) {
      console.error('Error creating user:', err)
      alert('Erreur lors de la création: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateStation() {
    if (!newStation.name || !newStation.municipality || !newStation.neighborhood) {
      showToast('warning', 'Veuillez remplir tous les champs obligatoires')
      return
    }

    const lat = parseFloat(newStation.latitude)
    const lng = parseFloat(newStation.longitude)

    if (isNaN(lat) || isNaN(lng)) {
      showToast('warning', 'Les coordonnées GPS sont invalides')
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('warning', 'Les coordonnées GPS sont hors limites')
      return
    }

    try {
      setCreatingStation(true)
      const { error } = await supabase.from('station').insert({
        name: newStation.name.trim(),
        brand: newStation.brand.trim() || null,
        municipality: newStation.municipality.trim(),
        neighborhood: newStation.neighborhood.trim(),
        latitude: lat,
        longitude: lng,
        is_active: true,
      })

      if (error) throw error

      showToast('success', 'Station créée avec succès !')
      setNewStation({
        name: '',
        brand: '',
        municipality: '',
        neighborhood: '',
        latitude: '',
        longitude: '',
        googleMapsUrl: '',
      })
      setShowCreateStation(false)
      await loadData()
    } catch (err: any) {
      console.error('Error creating station:', err)
      showToast('error', `Erreur lors de la création: ${err.message || 'Erreur inconnue'}`)
    } finally {
      setCreatingStation(false)
    }
  }

  async function handleImportCSV() {
    if (!csvContent.trim()) {
      alert('Veuillez coller le contenu CSV')
      return
    }

    try {
      setCreating(true)
      const lines = csvContent.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const emailIndex = headers.indexOf('email')
      const roleIndex = headers.indexOf('role')
      const stationIndex = headers.indexOf('station_id')

      if (emailIndex === -1 || roleIndex === -1) {
        alert('CSV doit contenir les colonnes: email, role (optionnel: station_id)')
        return
      }

      const usersToCreate = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        return {
          email: values[emailIndex],
          role: values[roleIndex],
          station_id: stationIndex >= 0 ? values[stationIndex] || null : null,
        }
      }).filter(u => u.email)

      // Get the session token to send in headers
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Session expirée. Veuillez vous reconnecter.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ users: usersToCreate }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const successCount = data.results.filter((r: any) => r.success).length
      const failedCount = data.results.length - successCount

      let message = `${successCount} utilisateur(s) créé(s).\n\n`
      if (failedCount > 0) {
        message += `${failedCount} échec(s):\n`
        data.results.filter((r: any) => !r.success).forEach((r: any) => {
          message += `- ${r.email}: ${r.error}\n`
        })
      }

      message += '\nMots de passe temporaires:\n'
      data.results.filter((r: any) => r.success).forEach((r: any) => {
        message += `${r.email}: ${r.tempPassword}\n`
      })

      alert(message)
      setCsvContent('')
      setShowImportCSV(false)
      await loadData()
    } catch (err: any) {
      console.error('Error importing CSV:', err)
      alert('Erreur lors de l&apos;import: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  // Check for map picker result from URL params
  useEffect(() => {
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const name = searchParams.get('name')

    if (lat && lng) {
      setNewStation((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        name: name || prev.name,
      }))
      
      // Switch to stations tab and open create form
      setActiveTab('stations')
      setShowCreateStation(true)
      
      showToast('success', '✓ Position sélectionnée sur la carte !')
      
      // Clean up URL params
      window.history.replaceState({}, '', '/admin')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-40 shadow-xl border-b-2 border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-gray-300 hover:text-white transition-colors"
              title="Retour"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Administration</h1>
              <p className="text-xs text-gray-400 mt-0.5">Panneau de contrôle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Notifications />
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all hover:scale-105 flex items-center gap-2"
              title="Se déconnecter"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Main KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-blue-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.totalStations}</div>
                <div className="text-sm text-gray-400 font-medium">Stations totales</div>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-green-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-400 mb-1">{stats.stationsWithFuel}</div>
                <div className="text-sm text-gray-400 font-medium">Avec carburant</div>
                {stats.fuelPercentageChange !== 0 && (
                  <div className={`text-xs mt-1 ${stats.fuelPercentageChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.fuelPercentageChange > 0 ? '+' : ''}{stats.fuelPercentageChange}% vs hier
                  </div>
                )}
              </Card>
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-red-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-red-400 mb-1">{stats.stationsOut}</div>
                <div className="text-sm text-gray-400 font-medium">En rupture</div>
              </Card>
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-yellow-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.avgWaitingTime} min</div>
                <div className="text-sm text-gray-400 font-medium">Attente Moy.</div>
                {stats.peakWaitingTime > 0 && (
                  <div className="text-xs text-gray-500 mt-1">Pic: {stats.peakWaitingTime} min</div>
                )}
              </Card>
            </div>

            {/* 24h Trends Chart */}
            <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up">
              <h3 className="text-lg font-bold text-white mb-4">Tendances d&apos;attente (24h)</h3>
              <WaitTimeTrendsChart />
            </Card>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setActiveTab('stations')}
                className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl hover:border-primary-teal transition-all flex flex-col items-center gap-2"
              >
                <div className="text-primary-teal">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-white">Stations</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl hover:border-blue-400 transition-all flex flex-col items-center gap-2"
              >
                <div className="text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-white">Users</span>
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl hover:border-purple-400 transition-all flex flex-col items-center gap-2"
              >
                <div className="text-purple-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-white">Config</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stations' && (
          <div className="space-y-4">
            {/* Add Station Button - Premium */}
            <Button
              variant="primary"
              fullWidth
              onClick={() => setShowCreateStation(true)}
              className="hover-glow transition-all animate-slide-in-up"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-xl">+</span>
                <span className="font-bold">AJOUTER UNE STATION</span>
              </span>
            </Button>

            {/* Create Station Form - Premium */}
            {showCreateStation && (
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white">CRÉER UNE STATION</h3>
                  <button
                    onClick={() => {
                      setShowCreateStation(false)
                      setNewStation({
                        name: '',
                        brand: '',
                        municipality: '',
                        neighborhood: '',
                        latitude: '',
                        longitude: '',
                        googleMapsUrl: '',
                      })
                    }}
                    className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Google Maps URL - Premium */}
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Lien Google Maps (optionnel)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={newStation.googleMapsUrl}
                        onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                        placeholder="https://www.google.com/maps/place/..."
                        className="flex-1 px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newStation.googleMapsUrl) {
                            handleGoogleMapsUrlChange(newStation.googleMapsUrl)
                          }
                        }}
                        className="whitespace-nowrap"
                      >
                        Extraire
                      </Button>
                    </div>
                    <div className="mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const params = new URLSearchParams({
                            lat: newStation.latitude || '12.65',
                            lng: newStation.longitude || '-8.0',
                          })
                          router.push(`/admin/map-picker?${params.toString()}`)
                        }}
                        fullWidth
                      >
                        🗺️ Chercher sur carte
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Nom <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.name}
                        onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="Nom de la station"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Marque
                      </label>
                      <input
                        type="text"
                        value={newStation.brand}
                        onChange={(e) => setNewStation({ ...newStation, brand: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="Ex: Total, Shell..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Commune <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.municipality}
                        onChange={(e) => setNewStation({ ...newStation, municipality: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="Commune"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Quartier <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.neighborhood}
                        onChange={(e) => setNewStation({ ...newStation, neighborhood: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="Quartier"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Latitude <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={newStation.latitude}
                        onChange={(e) => setNewStation({ ...newStation, latitude: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="12.123456"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Longitude <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={newStation.longitude}
                        onChange={(e) => setNewStation({ ...newStation, longitude: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-teal focus:border-primary-teal transition-all"
                        placeholder="-8.123456"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleCreateStation}
                      disabled={creatingStation}
                      className="hover-glow transition-all"
                    >
                      {creatingStation ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Création...
                        </span>
                      ) : (
                        'CRÉER LA STATION'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateStation(false)
                        setNewStation({
                          name: '',
                          brand: '',
                          municipality: '',
                          neighborhood: '',
                          latitude: '',
                          longitude: '',
                          googleMapsUrl: '',
                        })
                      }}
                      disabled={creatingStation}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Stations List - Premium */}
            <div className="space-y-3">
              {stations.map((station, index) => {
                const essenceStatus = station.statuses?.find((s) => s.fuel_type === 'ESSENCE')
                const gasoilStatus = station.statuses?.find((s) => s.fuel_type === 'GASOIL')
                const latestUpdate = station.statuses
                  ?.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]

                return (
                  <Card
                    key={station.id}
                    className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg text-white">{station.name}</h3>
                          {station.brand && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs font-semibold rounded">
                              {station.brand}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-1">
                          {station.neighborhood}, {station.municipality}
                        </p>
                        {latestUpdate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Dernière mise à jour: {formatTimeAgo(latestUpdate.updated_at)}
                          </p>
                        )}
                        {!latestUpdate && (
                          <p className="text-xs text-gray-500 mt-1">Aucune mise à jour</p>
                        )}
                      </div>
                    </div>

                    {/* Fuel Status Display - Premium */}
                    <div className="space-y-2 pt-4 border-t-2 border-gray-700">
                      <div className="flex items-center justify-between p-3 bg-gray-700/60 rounded-xl border border-gray-600 gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <FuelStatusIcon status={essenceStatus?.availability ?? null} size={32} />
                          <div className="flex-1">
                            <div className="font-semibold text-white text-sm">Essence</div>
                            {essenceStatus && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {formatTimeAgo(essenceStatus.updated_at)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-white text-right min-w-[80px]">
                          {essenceStatus
                            ? getAvailabilityLabel(essenceStatus.availability)
                            : 'Inconnu'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-700/60 rounded-xl border border-gray-600 gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <FuelStatusIcon status={gasoilStatus?.availability ?? null} size={32} />
                          <div className="flex-1">
                            <div className="font-semibold text-white text-sm">Gasoil</div>
                            {gasoilStatus && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {formatTimeAgo(gasoilStatus.updated_at)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-white text-right min-w-[80px]">
                          {gasoilStatus
                            ? getAvailabilityLabel(gasoilStatus.availability)
                            : 'Inconnu'}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Aucune alerte ouverte"
                description="Toutes les alertes sont résolues."
              />
            ) : (
              alerts.map((alert, index) => (
                <Card
                  key={alert.id}
                  className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="font-bold text-lg text-white">
                          {alert.type === 'NO_UPDATE' && 'Pas de mise à jour'}
                          {alert.type === 'HIGH_WAIT' && 'Temps d\'attente élevé'}
                          {alert.type === 'CONTRADICTION' && 'Contradiction'}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Créée {formatTimeAgo(alert.created_at)}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => resolveAlert(alert.id)}
                      className="hover-glow transition-all"
                    >
                      Résoudre
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => setShowCreateUser(true)}
                className="flex-1"
              >
                + Ajouter un utilisateur
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowImportCSV(true)}
                className="flex-1"
              >
                📄 Importer CSV
              </Button>
            </div>

            {showCreateUser && (
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white">Créer un utilisateur</h3>
                  <button
                    onClick={() => {
                      setShowCreateUser(false)
                      setNewUser({ email: '', role: 'TRUSTED_REPORTER', station_id: '', password: '' })
                      setCreatedPassword(null)
                    }}
                    className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">Rôle</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
                    >
                      <option value="TRUSTED_REPORTER">Rapporteur vérifié</option>
                      <option value="STATION_MANAGER">Gestionnaire de station</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">Station (optionnel)</label>
                    <select
                      value={newUser.station_id}
                      onChange={(e) => setNewUser({ ...newUser, station_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
                    >
                      <option value="">Aucune</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">
                      Mot de passe par défaut (optionnel)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
                        placeholder="Laissé vide = génération automatique"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Generate a random password
                          const randomPassword = Math.random().toString(36).slice(-10) + 'A1!'
                          setNewUser({ ...newUser, password: randomPassword })
                        }}
                        className="whitespace-nowrap"
                      >
                        Générer
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Si vide, un mot de passe sera généré automatiquement
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handleCreateUser}
                      disabled={creating}
                      className="flex-1"
                    >
                      {creating ? 'Création...' : 'Créer'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateUser(false)
                        setNewUser({ email: '', role: 'TRUSTED_REPORTER', station_id: '', password: '' })
                        setCreatedPassword(null)
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                  {createdPassword && (
                    <div className="mt-4 p-4 bg-green-900/30 border-2 border-green-600 rounded-lg">
                      <p className="text-sm font-semibold text-green-200 mb-2">
                        ✓ Utilisateur créé avec succès !
                      </p>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-300">Mot de passe par défaut :</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded font-mono text-sm">
                            {createdPassword}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(createdPassword)
                              alert('Mot de passe copié !')
                            }}
                          >
                            📋 Copier
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                          L&apos;utilisateur devra changer ce mot de passe lors de sa première connexion.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {showImportCSV && (
              <Card className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white">Importer des utilisateurs (CSV)</h3>
                  <button
                    onClick={() => {
                      setShowImportCSV(false)
                      setCsvContent('')
                    }}
                    className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">
                      Format CSV: email,role,station_id (optionnel)
                    </label>
                    <textarea
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-teal focus:border-primary-teal"
                      rows={8}
                      placeholder="email,role,station_id&#10;user1@example.com,TRUSTED_REPORTER,&#10;user2@example.com,STATION_MANAGER,station-uuid"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handleImportCSV}
                      disabled={creating}
                      className="flex-1"
                    >
                      {creating ? 'Import...' : 'Importer'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportCSV(false)
                        setCsvContent('')
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {users.map((user: any, index) => (
                <Card
                  key={user.id}
                  className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 animate-slide-in-up hover-lift transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-bold text-white text-lg">{user.email_or_phone}</div>
                        {user.is_verified && (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs font-semibold rounded border border-green-700">
                            ✓ Vérifié
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">{user.role}</div>
                      {user.station && (
                        <div className="text-sm text-gray-500 mb-2">Station: {user.station.name}</div>
                      )}
                      {user.must_change_password && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-900/50 text-yellow-300 text-xs font-semibold rounded border border-yellow-700">
                          Doit changer le mot de passe
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <AdminBottomNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as any)} />
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  )
}

