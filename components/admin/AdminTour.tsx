"use client"

import { useEffect, useRef } from "react"
import { driver, DriveStep } from "driver.js"
import "driver.js/dist/driver.css"
import { Button } from "@/components/ui/button"
import { PlayCircle } from "lucide-react"

interface AdminTourProps {
  steps: DriveStep[]
  tourId: string // Unique ID to track if user has seen it (optional, for future use)
}

export function AdminTour({ steps }: AdminTourProps) {
  const driverObj = useRef<ReturnType<typeof driver>>(null)

  useEffect(() => {
    driverObj.current = driver({
      showProgress: true,
      steps: steps,
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
    })
  }, [steps])

  const startTour = () => {
    driverObj.current?.drive()
  }

  return (
    <Button variant="outline" size="sm" onClick={startTour} className="gap-2">
      <PlayCircle className="h-4 w-4" />
      Start Tour
    </Button>
  )
}
