'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from './BottomNav'

export function ConditionalBottomNav() {
  const pathname = usePathname()
  
  // Hide standard bottom nav on admin page (it has its own AdminBottomNav)
  if (pathname === '/admin') {
    return null
  }

  return <BottomNav />
}

