import { createClient } from './supabase/server'
import type { StationStatus, Contribution } from './supabase/types'

const AVG_MINUTES_PER_VEHICLE = 3 // Average time per vehicle at pump

/**
 * Compute waiting time based on queue category and pumps active
 */
export async function computeWaitingTime(stationId: string): Promise<{
  waiting_time_min: number | null
  waiting_time_max: number | null
}> {
  const supabase = await createClient()

  // Get latest contributions with queue info
  const { data: contributions } = await supabase
    .from('contribution')
    .select('queue_category')
    .eq('station_id', stationId)
    .not('queue_category', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get latest station status for pumps_active
  const { data: status } = await supabase
    .from('station_status')
    .select('pumps_active')
    .eq('station_id', stationId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const pumpsActive = status?.pumps_active || 1

  if (!contributions || contributions.length === 0) {
    return { waiting_time_min: null, waiting_time_max: null }
  }

  // Use most recent queue category
  const latestQueue = contributions[0]?.queue_category

  if (!latestQueue) {
    return { waiting_time_min: null, waiting_time_max: null }
  }

  // Estimate vehicles in queue based on category
  let vehiclesMin = 0
  let vehiclesMax = 0

  switch (latestQueue) {
    case 'Q_0_10':
      vehiclesMin = 0
      vehiclesMax = 3
      break
    case 'Q_10_30':
      vehiclesMin = 3
      vehiclesMax = 10
      break
    case 'Q_30_60':
      vehiclesMin = 10
      vehiclesMax = 20
      break
    case 'Q_60_PLUS':
      vehiclesMin = 20
      vehiclesMax = 50
      break
  }

  // Calculate waiting time: vehicles / pumps_active * avg_minutes
  const waitingTimeMin = Math.floor((vehiclesMin / pumpsActive) * AVG_MINUTES_PER_VEHICLE)
  const waitingTimeMax = Math.floor((vehiclesMax / pumpsActive) * AVG_MINUTES_PER_VEHICLE)

  return {
    waiting_time_min: waitingTimeMin,
    waiting_time_max: waitingTimeMax,
  }
}

/**
 * Compute reliability score based on source weights and recency
 */
export async function computeReliabilityScore(stationId: string): Promise<number> {
  const supabase = await createClient()

  // Get recent contributions (last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { data: contributions } = await supabase
    .from('contribution')
    .select('source_type, created_at, fuel_status')
    .eq('station_id', stationId)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })

  if (!contributions || contributions.length === 0) {
    return 0 // No recent data = low reliability
  }

  let score = 0
  const now = Date.now()

  // Weight sources: OFFICIAL = 10, TRUSTED = 5, PUBLIC = 1
  const sourceWeights: Record<string, number> = {
    OFFICIAL: 10,
    TRUSTED: 5,
    PUBLIC: 1,
  }

  // Check for contradictions (different fuel_status in short window)
  const recentWindow = 30 * 60 * 1000 // 30 minutes
  const recentContributions = contributions.filter(
    (c) => now - new Date(c.created_at).getTime() < recentWindow
  )

  const fuelStatuses = recentContributions
    .map((c) => c.fuel_status)
    .filter((s): s is string => s !== null)

  const hasContradiction = new Set(fuelStatuses).size > 1

  // Calculate score
  for (const contrib of contributions.slice(0, 10)) {
    // Recency penalty: older = less weight
    const age = now - new Date(contrib.created_at).getTime()
    const recencyFactor = Math.max(0, 1 - age / (2 * 60 * 60 * 1000)) // Decay over 2 hours

    const sourceWeight = sourceWeights[contrib.source_type] || 1
    score += sourceWeight * recencyFactor
  }

  // Penalize contradictions
  if (hasContradiction) {
    score *= 0.5
  }

  // Penalize old updates (no update in last hour)
  const latestUpdate = contributions[0]?.created_at
  if (latestUpdate) {
    const timeSinceUpdate = now - new Date(latestUpdate).getTime()
    if (timeSinceUpdate > 60 * 60 * 1000) {
      score *= 0.7
    }
  }

  return Math.round(score)
}

/**
 * Generate alerts for stations
 */
export async function generateAlerts() {
  const supabase = await createClient()

  // Get all active stations
  const { data: stations } = await supabase
    .from('station')
    .select('id')
    .eq('is_active', true)

  if (!stations) return

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  for (const station of stations) {
    // Get latest status
    const { data: latestStatus } = await supabase
      .from('station_status')
      .select('*')
      .eq('station_id', station.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    // Check for NO_UPDATE alert
    if (!latestStatus || new Date(latestStatus.updated_at) < new Date(ninetyMinutesAgo)) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('alert')
        .select('id')
        .eq('station_id', station.id)
        .eq('type', 'NO_UPDATE')
        .eq('status', 'OPEN')
        .single()

      if (!existingAlert) {
        await supabase.from('alert').insert({
          station_id: station.id,
          type: 'NO_UPDATE',
          status: 'OPEN',
        })
      }
    }

    // Check for HIGH_WAIT alert
    if (latestStatus && latestStatus.waiting_time_max && latestStatus.waiting_time_max > 90) {
      const { data: existingAlert } = await supabase
        .from('alert')
        .select('id')
        .eq('station_id', station.id)
        .eq('type', 'HIGH_WAIT')
        .eq('status', 'OPEN')
        .single()

      if (!existingAlert) {
        await supabase.from('alert').insert({
          station_id: station.id,
          type: 'HIGH_WAIT',
          status: 'OPEN',
        })
      }
    }

    // Check for CONTRADICTION alert
    const { data: recentContributions } = await supabase
      .from('contribution')
      .select('fuel_status, created_at')
      .eq('station_id', station.id)
      .gte('created_at', oneHourAgo)
      .not('fuel_status', 'is', null)

    if (recentContributions && recentContributions.length >= 2) {
      const statuses = new Set(recentContributions.map((c) => c.fuel_status))
      if (statuses.size > 1) {
        const { data: existingAlert } = await supabase
          .from('alert')
          .select('id')
          .eq('station_id', station.id)
          .eq('type', 'CONTRADICTION')
          .eq('status', 'OPEN')
          .single()

        if (!existingAlert) {
          await supabase.from('alert').insert({
            station_id: station.id,
            type: 'CONTRADICTION',
            status: 'OPEN',
          })
        }
      }
    }
  }
}

