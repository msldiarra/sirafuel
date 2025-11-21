import { formatDistanceToNow } from 'date-fns'
import type { Availability, QueueCategory, UserRole } from './supabase/types'

export function formatTimeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
      .replace('about ', '')
      .replace('less than a minute ago', 'il y a quelques instants')
      .replace('minute ago', 'minute')
      .replace('minutes ago', 'minutes')
      .replace('hour ago', 'heure')
      .replace('hours ago', 'heures')
      .replace('day ago', 'jour')
      .replace('days ago', 'jours')
      .replace('ago', '')
  } catch {
    return 'il y a quelques instants'
  }
}

export function getAvailabilityIcon(availability: Availability | null): string {
  switch (availability) {
    case 'AVAILABLE':
      return '🟢'
    case 'LIMITED':
      return '🟡'
    case 'OUT':
      return '🔴'
    default:
      return '⚪'
  }
}

export function getAvailabilityLabel(availability: Availability | null): string {
  switch (availability) {
    case 'AVAILABLE':
      return 'Disponible'
    case 'LIMITED':
      return 'Limité'
    case 'OUT':
      return 'Rupture'
    default:
      return 'Inconnu'
  }
}

export function getQueueLabel(category: QueueCategory | null): string {
  switch (category) {
    case 'Q_0_10':
      return '0-10 min'
    case 'Q_10_30':
      return '10-30 min'
    case 'Q_30_60':
      return '30-60 min'
    case 'Q_60_PLUS':
      return '60+ min'
    default:
      return 'Inconnu'
  }
}

export function getReliabilityLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 50) return 'High'
  if (score >= 20) return 'Medium'
  return 'Low'
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'PUBLIC':
      return 'Public'
    case 'STATION_MANAGER':
      return 'Gestionnaire'
    case 'TRUSTED_REPORTER':
      return 'Rapporteur vérifié'
    case 'ADMIN':
      return 'Administrateur'
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

