"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Save, CheckCircle } from "lucide-react"
import { saveAttemptProgress } from "@/features/attempts/services/attemptService"
import type { Message } from "@/features/chat/models/chat"

type SaveAttemptButtonProps = {
  attemptId: string
  stageIndex: number
  messages: Message[]
  timeSpentSeconds: number
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function SaveAttemptButton({
  attemptId,
  stageIndex,
  messages,
  timeSpentSeconds,
  variant = "outline",
  size = "sm"
}: SaveAttemptButtonProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const handleSave = async () => {
    if (isSaving) return
    
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const success = await saveAttemptProgress(
        attemptId,
        stageIndex,
        messages,
        timeSpentSeconds
      )
      
      if (success) {
        setSaveSuccess(true)
        
        // Reset success status after 3 seconds
        setTimeout(() => {
          setSaveSuccess(false)
        }, 3000)
      }
    } catch (error) {
      console.error("Error saving attempt progress:", error)
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSave}
      disabled={isSaving}
      className={`transition-all duration-300 ${saveSuccess ? "bg-green-500 text-white hover:bg-green-600" : ""}`}
    >
      {isSaving ? (
        <>
          <span className="animate-pulse mr-2">Saving...</span>
        </>
      ) : saveSuccess ? (
        <>
          <CheckCircle className="h-4 w-4 mr-2" />
          Saved
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          Save Progress
        </>
      )}
    </Button>
  )
}
