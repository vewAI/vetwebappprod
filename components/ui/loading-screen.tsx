'use client'

import React from 'react'

export function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
