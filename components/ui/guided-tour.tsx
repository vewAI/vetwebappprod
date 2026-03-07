"use client"

import { useEffect, useRef } from "react"
import { driver, DriveStep } from "driver.js"
import "driver.js/dist/driver.css"
import { Button } from "@/components/ui/button"
import { PlayCircle } from "lucide-react"

interface GuidedTourProps {
  steps: DriveStep[]
  tourId: string // Unique ID to track if user has seen it (optional, for future use)
  className?: string
  autoStart?: boolean
}

export function GuidedTour({ steps, tourId, className, autoStart = false }: GuidedTourProps) {
  const driverObj = useRef<ReturnType<typeof driver>>(null)

  useEffect(() => {
    driverObj.current = driver({
      showProgress: true,
      steps: steps,
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
    })

    if (autoStart) {
      const hasSeen = localStorage.getItem(`tour-seen-${tourId}`)
      if (!hasSeen) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          driverObj.current?.drive()
          localStorage.setItem(`tour-seen-${tourId}`, 'true')
        }, 1000)
      }
    }
  }, [steps, tourId, autoStart])

  const startTour = () => {
    driverObj.current?.drive()
  }

  return (
    <Button id={`start-tour-${tourId}`} variant="outline" size="sm" onClick={startTour} className={`gap-2 ${className}`}>
      <PlayCircle className="h-4 w-4" />
      Start Tour
    </Button>
  )
}
