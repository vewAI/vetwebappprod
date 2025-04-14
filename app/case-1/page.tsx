"use client"

import { useEffect, useState } from "react"
import { notFound } from "next/navigation"
import { cases } from "@/features/case_selection/data/card-data"
import { ChatInterface } from "@/features/chat/components/chat-interface"
import { ProgressSidebar } from "@/features/chat/components/progress-sidebar"
import type { Message } from "@/features/chat/models/chat"
import type { Stage } from "@/features/stages/types"
import { getStagesForCase, getStageTransitionMessage, initializeStages, markStageCompleted } from "@/features/stages/services/stageService"

export default function Case1Page() {
  // Hardcode the case ID for this specific page
  const caseId = "case-1"
  const caseItem = cases.find((c) => c.id === caseId)
  
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

  if (!caseItem) {
    console.error(`Case with ID "${caseId}" not found`)
    return <div className="p-8 text-center">Case not found. Please check that the case exists in your data.</div>
  }

  // Update the initialMessages to include the first stage transition message
  const initialMessages: Message[] = [
    // {
    //   id: "1",
    //   role: "system",
    //   content:
    //     "Welcome to the OSCE simulation. I will be playing the role of the client and patient. Please proceed with your examination.",
    //   timestamp: new Date().toISOString(),
    // },
    // {
    //   id: "2",
    //   role: "assistant",
    //   content: `Hello, I'm here with my ${caseItem.species.toLowerCase()} who hasn't been feeling well. Can you help us?`,
    //   timestamp: new Date().toISOString(),
    // },
    // getStageTransitionMessage(0),
  ]

  // Update the handleProceedToNextStage function to add a transition message
  const handleProceedToNextStage = () => {
    if (currentStageIndex < stages.length - 1) {
      // Mark current stage as completed
      setStages(markStageCompleted(stages, currentStageIndex))
      
      // Move to next stage
      const nextStageIndex = currentStageIndex + 1
      setCurrentStageIndex(nextStageIndex)

      // Add a transition message to the chat
      const transitionMessage = getStageTransitionMessage(caseId, nextStageIndex)
      // You would need to add this message to your chat state
      // For example, if you had a setMessages function:
      // setMessages(prev => [...prev, transitionMessage]);
    } else {
      // Handle completion of the final stage
      setStages(markStageCompleted(stages, currentStageIndex))

      // You could navigate to a results page or show a completion modal
      alert("Examination completed! You've finished all stages.")
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
    </div>
  )
}
