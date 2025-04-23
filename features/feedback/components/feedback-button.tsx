"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Message } from "@/features/chat/models/chat"
import { Stage } from "@/features/stages/types"
import { Loader2, X } from "lucide-react"
import axios from "axios"

type FeedbackButtonProps = {
  messages: Message[]
  stage: Stage
  stageIndex: number
  caseId: string
}

export function FeedbackButton({ messages, stage, stageIndex, caseId }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFeedbackAvailable, setIsFeedbackAvailable] = useState(true)
  
  // Check if feedback is available for this stage
  useEffect(() => {
    const checkFeedbackAvailability = async () => {
      try {
        if (caseId === "case-1") {
          const availableStages = ["History Taking", "Owner Follow-up"]
          setIsFeedbackAvailable(availableStages.includes(stage.title))
        } else {
          setIsFeedbackAvailable(true)
        }
      } catch (error) {
        console.error("Error checking feedback availability:", error)
        setIsFeedbackAvailable(false)
      }
    }
    
    checkFeedbackAvailability()
  }, [stage, caseId])
  
  const handleGenerateFeedback = async () => {
    setIsOpen(true)
    setIsLoading(true)
    
    try {
      // Filter messages relevant to this stage
      const stageMessages = messages.filter(msg => 
        msg.stageIndex === stageIndex
      )
      
      // Call the feedback API
      const response = await axios.post('/api/feedback', {
        messages: stageMessages,
        stageIndex,
        caseId,
        stageName: stage.title
      })
      
      setFeedback(response.data.feedback)
    } catch (error) {
      console.error('Error generating feedback:', error)
      setFeedback("Sorry, there was an error generating feedback. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <>
      <Button 
        onClick={handleGenerateFeedback}
        variant="outline" 
        className="text-sm bg-gradient-to-l from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 border-none"
        disabled={!isFeedbackAvailable}
      >
        Generate Feedback
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Feedback: {stage.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Assessment of your performance in this stage
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Generating feedback...</span>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: feedback }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}