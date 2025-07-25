"use client"

import { Button } from "@/components/ui/button"
import { Save, CheckCircle } from "lucide-react"
import type { Message } from "@/features/chat/models/chat"
import { useSaveAttempt } from "../hooks/useSaveAttempt"

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
  const { saveProgress, isSaving, saveSuccess } = useSaveAttempt(attemptId)
  
  const handleSave = async () => {
    await saveProgress(stageIndex, messages, timeSpentSeconds)
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
