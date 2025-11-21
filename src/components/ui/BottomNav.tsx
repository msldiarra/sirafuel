'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

export function BottomNav() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadUserRole()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUserRole() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('user_profile')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      setUserRole(profile?.role || null)
    } catch (err) {
      console.error('Error loading user role:', err)
    } finally {
      setLoading(false)
    }
  }

  // Base navigation items - always shown
  const baseNavItems: NavItem[] = [
    {
      id: 'home',
      label: 'STATIONS',
      href: '/',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
  ]

  // Contribute item - shown for all except TRUSTED_REPORTER
  const contributeNavItem: NavItem = {
    id: 'contribute',
    label: 'CONTRIBUER',
    href: '/contribute',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  }

  // Third position item - depends on role (only for STATION_MANAGER and TRUSTED_REPORTER)
  const thirdNavItem: NavItem | null =
    userRole === 'STATION_MANAGER'
      ? {
          id: 'manager',
          label: 'GÉRER',
          href: '/manager',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        }
      : userRole === 'TRUSTED_REPORTER'
      ? {
          id: 'reporter',
          label: 'RAPPORTER',
          href: '/trusted',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        }
      : null

  // Last item - always profile
  const profileNavItem: NavItem = {
    id: 'profile',
    label: 'PROFIL',
    href: '/profile',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  }

  // Build final nav items array
  const navItems: NavItem[] = [...baseNavItems]
  
  // Add CONTRIBUER for all users except TRUSTED_REPORTER
  if (userRole !== 'TRUSTED_REPORTER') {
    navItems.push(contributeNavItem)
  }
  
  // Add third position item (role-specific)
  if (thirdNavItem) {
    navItems.push(thirdNavItem)
  }
  
  // Always add profile
  navItems.push(profileNavItem)

  // Show loading state with default nav (without role-specific items)
  if (loading) {
    const defaultNavItems: NavItem[] = [
      ...baseNavItems,
      contributeNavItem,
      profileNavItem,
    ]

    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t-2 border-gray-700 z-50 shadow-lg">
        <div className="flex justify-around items-center h-16">
          {defaultNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/' && pathname === '/')
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary-teal' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {item.icon}
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t-2 border-gray-700 z-50 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/' && pathname === '/') ||
            (item.id === 'manager' && pathname.startsWith('/manager')) ||
            (item.id === 'reporter' && pathname.startsWith('/trusted')) ||
            (item.id === 'contribute' && pathname.startsWith('/contribute'))
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-primary-teal' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {item.icon}
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
