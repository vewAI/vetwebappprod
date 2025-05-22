'use client'

import { useAuth } from '@/features/auth/services/authService'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { LoadingScreen } from '@/components/ui/loading-screen'

export function ProtectedRoute({ 
  children 
}: { 
  children: ReactNode 
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip protection for the login page
    if (pathname === '/login') {
      return
    }
    
    // If not loading and no user, redirect to login
    if (!loading && !user) {
      console.log('Not authenticated, redirecting to login')
      router.push('/login')
    }
  }, [user, loading, router, pathname])

  // If on login page and authenticated, redirect to home
  useEffect(() => {
    if (!loading && user && pathname === '/login') {
      console.log('Already authenticated, redirecting to home')
      router.push('/')
    }
  }, [user, loading, router, pathname])

  // Show loading screen while checking auth
  if (loading) {
    return <LoadingScreen />
  }
  
  // If on login page or user is authenticated, render children
  if (pathname === '/login' || user) {
    return <>{children}</>
  }
  
  // Otherwise render loading screen while redirecting
  return <LoadingScreen />
}
