"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { SendIcon, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChatMessage } from "@/features/chat/components/chat-message"
import { Notepad } from "@/features/chat/components/notepad"
import { FeedbackButton } from "@/features/feedback/components/feedback-button"
import type { Message } from "@/features/chat/models/chat"
import type { Stage } from "@/features/stages/types"
import { getStageTransitionMessage } from "@/features/stages/services/stageService"
import axios from "axios"

type ChatInterfaceProps = {
  caseId: string
  initialMessages?: Message[]
  currentStageIndex: number
  stages: Stage[]
  onProceedToNextStage: (messages?: Message[]) => void
}

export function ChatInterface({
  caseId,
  initialMessages = [],
  currentStageIndex,
  stages,
  onProceedToNextStage,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showNotepad, setShowNotepad] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-focus textarea when loaded
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Handle stage transitions
  useEffect(() => {
    if (currentStageIndex > 0) {
      // Get the custom transition message for this case and stage
      const transitionMessage = getStageTransitionMessage(caseId, currentStageIndex);
      
      // Add the transition message to the chat
      setMessages((prev) => [...prev, {
        ...transitionMessage,
        id: `${transitionMessage.id}-${Date.now()}`,
        displayRole: "Virtual Examiner"
      }]);
    }
  }, [currentStageIndex, caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
      stageIndex: currentStageIndex,
      displayRole: "You"
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Format messages for the API
      const apiMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));
  
      // Call the API using axios instead of fetch
      const response = await axios.post('/api/chat', {
        messages: apiMessages,
        stageIndex: currentStageIndex,
        caseId: caseId,
      });
  
      // Add AI response to messages
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.data.content,
        timestamp: new Date().toISOString(),
        stageIndex: currentStageIndex,
        displayRole: stages[currentStageIndex].role
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error getting chat response:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: "Sorry, there was an error processing your request. Please try again.",
        timestamp: new Date().toISOString(),
        stageIndex: currentStageIndex,
        displayRole: "Virtual Examiner"
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isLastStage = currentStageIndex === stages.length - 1
  const nextStageTitle = isLastStage ? "Complete Examination" : `Proceed to ${stages[currentStageIndex + 1]?.title || "Next Stage"}`

  return (
    <div className="relative flex h-full flex-col">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              stages={stages}
            />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Proceed to Next Stage button */}
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex justify-between items-center mb-4 gap-4">
            <Button 
              onClick={() => onProceedToNextStage(messages)} 
              disabled={false} 
              className={`flex-1 ${isLastStage 
                ? "bg-gradient-to-l from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600" 
                : "bg-gradient-to-l from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"} 
                text-white border-none transition-all duration-300`} 
              variant="outline"
            >
              {nextStageTitle}
            </Button>
            
            <FeedbackButton 
              messages={messages}
              stage={stages[currentStageIndex]}
              stageIndex={currentStageIndex}
              caseId={caseId}
            />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[60px] w-full resize-none pr-12"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={`absolute bottom-2 right-2 ${
                input.trim() 
                  ? "bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none" 
                  : ""
              }`}
            >
              <SendIcon className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-xs"
              onClick={() => setShowNotepad(!showNotepad)}
            >
              <PenLine className="h-3.5 w-3.5" />
              {showNotepad ? "Hide Notepad" : "Show Notepad"}
            </Button>
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>

      {/* Notepad */}
      <Notepad isOpen={showNotepad} onClose={() => setShowNotepad(false)} />
    </div>
  )
}
