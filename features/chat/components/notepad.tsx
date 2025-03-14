"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type NotepadProps = {
  isOpen: boolean
  onClose: () => void
}

export function Notepad({ isOpen, onClose }: NotepadProps) {
  const [notes, setNotes] = useState("")

  // Load notes from localStorage when component mounts
  useEffect(() => {
    const savedNotes = localStorage.getItem("osce-notes")
    if (savedNotes) {
      setNotes(savedNotes)
    }
  }, [])

  // Save notes to localStorage when they change
  useEffect(() => {
    localStorage.setItem("osce-notes", notes)
  }, [notes])

  if (!isOpen) return null

  return (
    <div className="fixed bottom-[80px] right-4 z-50 w-80 rounded-lg border bg-background shadow-lg md:w-96">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="font-medium">Clinical Notes</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Take notes during your examination..."
          className="min-h-[200px] resize-none"
        />
        <p className="mt-2 text-xs text-muted-foreground">Notes are automatically saved to your browser</p>
      </div>
    </div>
  )
}

