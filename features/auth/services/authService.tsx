'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import axios from 'axios'

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

// Initialise Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// AuthProvider component that wraps the app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error.message)
        } else if (data.session) {
          setSession(data.session) 
          setUser(data.session.user)
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
      async (event, session) => {
        console.log(`Auth state changed: ${event}`)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        
        // Refresh the page on auth changes to update server components
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          router.refresh()
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
    try {
      // Call the login API route
      const response = await axios.post('/api/auth/login', { email, password });
      
      console.log('Login successful:', response.data);
      // Navigate to home page after successful login
      router.push('/');
    } catch (error) {
      throw error;
    }
  }

  // Sign out function that can be called from any component using useAuth()
  const signOut = async () => {
    try {
      // Call the signout API route
      await axios.post('/api/auth/signout');
      setUser(null);
      setSession(null);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Provide the auth context value to children
  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
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
