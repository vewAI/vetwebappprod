'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Define the shape of our auth context
type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {}
})

// AuthProvider component that wraps the app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error.message)
        } else {
          setSession(data.session)
        }
      } catch (error) {
        console.error('Unexpected error during getSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Set up a listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        setLoading(false)
        
        // Only handle redirects during initial auth events or explicit sign-in/out actions
        if (!isInitialized) {
          setIsInitialized(true)
          // Initial auth check - redirect only if needed
          if (!newSession && event === 'INITIAL_SESSION') {
            router.push('/login')
          }
        } else {
          // Handle explicit auth state changes
          if (event === 'SIGNED_IN') {
            router.push('/')
          } else if (event === 'SIGNED_OUT') {
            router.push('/login')
          }
        }
      }
    )

    // Clean up the listener when the component unmounts
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  // Sign in function that can be called from any component using useAuth()
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('Error signing in:', error)
      throw error
    }
  }

  // Sign out function that can be called from any component using useAuth()
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error)
      throw error
    }
    
    // Manually redirect to login page after successful logout
    router.push('/login')
  }

  // Provide the auth context value to children
  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook that can be used to access the auth context in any component
export function useAuth() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}
