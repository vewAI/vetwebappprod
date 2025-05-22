'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/features/auth/services/authService'
import { Button } from '@/components/ui/button'
import { Menu, X, Home, LayoutDashboard, LogOut } from 'lucide-react'

export function Navbar() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // do not render on login page
  if (pathname === '/login') {
    return null
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/favicon.ico" 
                alt="VEWAI Logo" 
                width={32} 
                height={32} 
                className="rounded-sm"
              />
              <span className="text-xl font-semibold text-primary">VEWAI</span>
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-4">
            <Link href="/" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <Home className="size-4" />
              <span>Home</span>
            </Link>
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed">
              <LayoutDashboard className="size-4" />
              <span>Admin</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={signOut}
              className="flex items-center gap-1.5 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </Button>
          </div>

          <div className="hidden md:flex md:items-center">
            {user && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                <span className="font-medium">Hello, {user.email?.split('@')[0] || 'User'}</span>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent hover:text-accent-foreground"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              onClick={toggleMenu}
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <X className="block size-6" aria-hidden="true" />
              ) : (
                <Menu className="block size-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {isMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {user && (
              <div className="border-b border-border pb-3 mb-3">
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                  Hello, {user.email?.split('@')[0] || 'User'}
                </div>
              </div>
            )}
            <Link 
              href="/" 
              className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              <Home className="size-5" />
              <span>Home</span>
            </Link>
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-muted-foreground cursor-not-allowed">
              <LayoutDashboard className="size-5" />
              <span>Admin</span>
            </div>
            <button 
              onClick={() => {
                setIsMenuOpen(false)
                signOut()
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
