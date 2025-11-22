'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from './Card'
import { formatTimeAgo } from '@/lib/utils'
import type { StationUpdateNotification } from '@/lib/supabase/types'

interface NotificationWithStation extends StationUpdateNotification {
  station?: {
    name: string
    neighborhood: string
    municipality: string
  }
}

export function Notifications() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationWithStation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(true)
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const previousUnreadCountRef = useRef(0)
  const supabase = createClient()

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
    
    loadNotifications()
    const unsubscribe = subscribeToNotifications()
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('Notifications: No user found')
        return
      }

      const { data: profile } = await supabase
        .from('user_profile')
        .select('id, notifications_enabled, role')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile) {
        console.log('Notifications: No profile found')
        return
      }

      // Only load notifications if user has right role
      if (!['TRUSTED_REPORTER', 'ADMIN'].includes(profile.role)) {
        console.log('Notifications: Wrong role', { role: profile.role })
        setNotifications([])
        setUnreadCount(0)
        setLoading(false)
        return
      }

      // If notifications are not enabled, show empty state but still show the component
      if (!profile.notifications_enabled) {
        console.log('Notifications: Not enabled - component will still show', { enabled: profile.notifications_enabled })
        setNotifications([])
        setUnreadCount(0)
        setLoading(false)
        // Don't return - let the component render with empty state
        return
      }

      const { data: notifs, error } = await supabase
        .from('station_update_notification')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading notifications:', error)
        return
      }

      if (notifs) {
        console.log('Notifications loaded:', notifs.length)
        // Load station info for each notification
        const notificationsWithStations = await Promise.all(
          notifs.map(async (n) => {
            const { data: stationData } = await supabase
              .from('station')
              .select('name, neighborhood, municipality')
              .eq('id', n.station_id)
              .single()
            
            return {
              ...n,
              station: stationData || undefined,
            }
          })
        )
        
        const newUnreadCount = notificationsWithStations.filter((n) => !n.is_read).length
        const previousCount = previousUnreadCountRef.current
        
        setNotifications(notificationsWithStations)
        setUnreadCount(newUnreadCount)
        
        // Show browser notification if new unread notifications
        if (newUnreadCount > previousCount && previousCount >= 0 && notificationPermission === 'granted') {
          const newNotifications = notificationsWithStations
            .filter((n) => !n.is_read)
            .slice(0, newUnreadCount - previousCount)
          
          if (newNotifications.length > 0) {
            const stationName = newNotifications[0].station?.name
            showBrowserNotification(newNotifications.length, stationName)
          }
        }
        previousUnreadCountRef.current = newUnreadCount
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  function showBrowserNotification(count: number, stationName?: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const message = count === 1 && stationName
      ? `Mise à jour: ${stationName}`
      : count === 1
      ? 'Nouvelle mise à jour de station disponible'
      : `${count} nouvelles mises à jour de stations disponibles`

    const notification = new Notification('SiraFuel - Mise à jour', {
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'station-update',
      requireInteraction: false,
    })

    notification.onclick = () => {
      window.focus()
      setShowList(true)
      notification.close()
    }

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close()
    }, 5000)
  }

  function subscribeToNotifications() {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'station_update_notification',
        },
        async (payload) => {
          console.log('New notification received:', payload)
          // Reload notifications and show browser notification
          await loadNotifications()
          // Show browser notification for new notification
          if (notificationPermission === 'granted' && payload.new) {
            const { data: stationData } = await supabase
              .from('station')
              .select('name')
              .eq('id', payload.new.station_id)
              .single()
            
            showBrowserNotification(1, stationData?.name || 'Station')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Votre navigateur ne supporte pas les notifications')
      return
    }

    if (Notification.permission === 'granted') {
      alert('Les notifications sont déjà activées')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    
    if (permission === 'granted') {
      // Show a test notification
      showBrowserNotification(1, 'Test')
    } else if (permission === 'denied') {
      alert('Les notifications ont été refusées. Vous pouvez les activer dans les paramètres de votre navigateur.')
    }
  }

  async function markAsRead(notificationId: string) {
    await supabase
      .from('station_update_notification')
      .update({ is_read: true })
      .eq('id', notificationId)
    
    // Delete after marking as read
    setTimeout(async () => {
      await supabase
        .from('station_update_notification')
        .delete()
        .eq('id', notificationId)
      loadNotifications()
    }, 500) // Small delay for smooth UX
  }

  async function markAllAsRead() {
    try {
      setMarkingAllAsRead(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profile')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!profile) return

      // Mark all as read
      await supabase
        .from('station_update_notification')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)

      // Delete all read notifications after marking
      setTimeout(async () => {
        await supabase
          .from('station_update_notification')
          .delete()
          .eq('user_id', profile.id)
        await loadNotifications()
        setMarkingAllAsRead(false)
      }, 500)
    } catch (err) {
      console.error('Error marking all as read:', err)
      setMarkingAllAsRead(false)
    }
  }

  function handleNotificationClick(notification: NotificationWithStation) {
    markAsRead(notification.id)
    router.push(`/updates/${notification.id}`)
    setShowList(false)
  }

  if (loading) {
    return (
      <button className="relative p-2 text-gray-300 hover:text-white transition-colors">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowList(!showList)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
        title="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {notificationPermission === 'default' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-gray-900 animate-pulse" title="Cliquez pour activer les notifications push" />
        )}
      </button>
      
      {notificationPermission === 'default' && showList && (
        <div className="fixed left-4 right-4 top-20 md:absolute md:right-0 md:top-full md:left-auto md:w-80 md:mt-2 bg-yellow-900/20 border-2 border-yellow-600 rounded-xl p-4 z-50">
          <p className="text-sm text-yellow-200 mb-2">
            Activez les notifications push pour être alerté même quand l'application n'est pas ouverte.
          </p>
          <button
            onClick={requestNotificationPermission}
            className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
          >
            Activer les notifications
          </button>
        </div>
      )}

      {showList && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowList(false)}
          />
          <div className="fixed left-4 right-4 top-20 md:absolute md:right-0 md:top-full md:left-auto md:w-80 md:mt-2 bg-gray-800 border-2 border-gray-700 rounded-xl shadow-xl z-50 max-h-[70vh] md:max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white">Notifications</h3>
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={requestNotificationPermission}
                    className="text-xs px-2 py-1 bg-primary-teal/20 text-primary-teal rounded hover:bg-primary-teal/30 transition-colors"
                    title="Activer les notifications push"
                  >
                    Activer
                  </button>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={markingAllAsRead}
                  className="w-full text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markingAllAsRead ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                      Suppression...
                    </span>
                  ) : (
                    `✓ Tout marquer comme lu (${unreadCount})`
                  )}
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-2">Aucune notification</div>
                <div className="text-xs text-gray-500 mb-4">
                  Les notifications apparaîtront ici lorsqu'une station sera mise à jour
                </div>
                <div className="text-xs text-yellow-400">
                  💡 Activez les notifications dans votre profil pour recevoir des alertes
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-4 text-left hover:bg-gray-700 transition-colors ${
                      !notification.is_read ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white mb-1 truncate">
                          {notification.station?.name || 'Station'}
                        </div>
                        <div className="text-sm text-gray-400 mb-1 truncate">
                          {notification.station?.neighborhood}, {notification.station?.municipality}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimeAgo(notification.created_at)}
                        </div>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-primary-teal rounded-full mt-2 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

