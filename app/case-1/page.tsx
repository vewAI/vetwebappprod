"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { useSearchParams } from "next/navigation"
import { cases } from "@/features/case-selection/data/card-data"
import { ChatInterface } from "@/features/chat/components/chat-interface"
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar"
import { CompletionDialog } from "@/features/feedback/components/completion-dialog"
import type { Message } from "@/features/chat/models/chat"
import type { Stage } from "@/features/stages/types"
import { getStagesForCase, initializeStages, markStageCompleted } from "@/features/stages/services/stageService"

export default function Case1Page() {
  // Hardcode the case ID for this specific page
  const caseId = "case-1"
  const caseItem = cases.find((c) => c.id === caseId)
  const searchParams = useSearchParams()
  
  const [isMobile, setIsMobile] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  
  // Initialise stages
  const [stages, setStages] = useState<Stage[]>(() => {
    const caseStages = getStagesForCase(caseId);
    return initializeStages(caseStages);
  })

  // Add a function to handle selecting a specific stage
  const handleStageSelect = (index: number) => {
    setCurrentStageIndex(index)
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      setShowSidebar(window.innerWidth >= 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])
  
  // Check for reset parameter and reset the state if present
  useEffect(() => {
    const reset = searchParams.get('reset')
    if (reset === 'true') {
      // Reset to initial state
      setCurrentStageIndex(0)
      const caseStages = getStagesForCase(caseId)
      setStages(initializeStages(caseStages))
      setShowCompletionDialog(false)
      setFeedbackContent('')
      
      // Remove the reset parameter from the URL to prevent resetting on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('reset')
      window.history.replaceState({}, '', url)
    }
  }, [searchParams, caseId])

  if (!caseItem) {
    console.error(`Case with ID "${caseId}" not found`)
    return <div className="p-8 text-center">Case not found. Please check that the case exists in your data.</div>
  }

  // Update the initialMessages to include the first stage transition message
  const initialMessages: Message[] = []

  // State for tracking loading state during feedback generation
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState("")

  // Update the handleProceedToNextStage function to add a transition message and handle completion
  const handleProceedToNextStage = async (messages?: Message[]) => {
    if (currentStageIndex < stages.length - 1) {
      // Mark current stage as completed
      setStages(markStageCompleted(stages, currentStageIndex))
      
      // Move to next stage
      const nextStageIndex = currentStageIndex + 1
      setCurrentStageIndex(nextStageIndex)
    } else {
      // Handle completion of the final stage
      setStages(markStageCompleted(stages, currentStageIndex))

      // Generate overall feedback if we have messages
      if (messages && messages.length > 0) {
        try {
          setIsGeneratingFeedback(true)
          setShowCompletionDialog(true)
          
          // Call the API to generate feedback
          const response = await axios.post('/api/overall-feedback', {
            caseId: caseId,
            messages: messages
          })
          
          // Set the feedback content
          setFeedbackContent(response.data.feedback)
        } catch (error) {
          console.error('Error generating feedback:', error)
          setFeedbackContent("<p>Unable to generate feedback at this time. Please try again later.</p>")
        } finally {
          setIsGeneratingFeedback(false)
        }
      } else {
        // Fallback if no messages are available
        setShowCompletionDialog(true)
        setFeedbackContent("<p>Examination completed! You've finished all stages.</p>")
      }
    }
  }

  // Update the return statement to pass the new props
  return (
    <div className="flex h-[calc(100vh-1rem)] overflow-hidden rounded-lg border shadow-sm">
      {/* Mobile toggle for sidebar */}
      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-4 top-4 z-50 rounded-md bg-primary p-2 text-primary-foreground"
        >
          {showSidebar ? "Hide Stages" : "Show Stages"}
        </button>
      )}

      {/* Progress sidebar */}
      <div className={`${showSidebar ? "block" : "hidden"} w-64 md:block`}>
        <ProgressSidebar
          caseItem={caseItem}
          stages={stages}
          currentStageIndex={currentStageIndex}
          onStageSelect={handleStageSelect}
        />
      </div>

      {/* Chat interface */}
      <div className="flex-1">
        <ChatInterface
          caseId={caseItem.id}
          initialMessages={initialMessages}
          currentStageIndex={currentStageIndex}
          stages={stages}
          onProceedToNextStage={handleProceedToNextStage}
        />
      </div>

      {/* Completion Dialog */}
      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        feedback={feedbackContent}
        isLoading={isGeneratingFeedback}
        caseId={caseId.replace('case-', '')}
      />
    </div>
  )
}
