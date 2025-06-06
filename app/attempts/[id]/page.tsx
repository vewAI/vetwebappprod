"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { getAttemptById, deleteAttempt } from "@/features/attempts/services/attemptService"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ChevronLeft, Clock, Calendar, Trash2 } from "lucide-react"
import { cases } from "@/features/case-selection/data/card-data"
import { getStagesForCase } from "@/features/stages/services/stageService"
import type { Attempt, AttemptFeedback } from "@/features/attempts/models/attempt"
import type { Message } from "@/features/chat/models/chat"
import type { Stage } from "@/features/stages/types"

// Temporary Tabs components until we create the actual ones
const Tabs = ({ defaultValue, children, className }: { defaultValue: string, children: React.ReactNode, className?: string }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  // Clone children and pass activeTab to them
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, { activeTab });
    }
    return child;
  });
  
  return <div className={className}>{childrenWithProps}</div>;
};

const TabsList = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <div className={`flex space-x-2 ${className}`}>{children}</div>;
};

const TabsTrigger = ({ value, children, activeTab, onClick }: { value: string, children: React.ReactNode, activeTab?: string, onClick?: (value: string) => void }) => {
  return (
    <button 
      className={`px-4 py-2 rounded-md ${activeTab === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
      onClick={() => onClick && onClick(value)}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, activeTab }: { value: string, children: React.ReactNode, activeTab?: string }) => {
  if (activeTab !== value) return null;
  return <div className="mt-4">{children}</div>;
};

export default function ViewAttemptPage() {
  const params = useParams()
  const router = useRouter()
  const attemptId = params.id as string
  
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [feedback, setFeedback] = useState<AttemptFeedback[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("conversation")
  const [isDeleting, setIsDeleting] = useState(false)
  
  useEffect(() => {
    const loadAttempt = async () => {
      setIsLoading(true)
      
      const { attempt, messages, feedback } = await getAttemptById(attemptId)
      
      if (!attempt) {
        router.push('/attempts')
        return
      }
      
      setAttempt(attempt)
      
      // Transform messages to match the Message interface
      const transformedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        stageIndex: msg.stageIndex,
        displayRole: msg.displayRole
      }))
      
      setMessages(transformedMessages)
      setFeedback(feedback)
      
      // Load stages for this case
      const caseStages = getStagesForCase(attempt.caseId)
      setStages(caseStages)
      
      setIsLoading(false)
    }
    
    loadAttempt()
  }, [attemptId, router])
  
  const caseItem = attempt ? cases.find(c => c.id === attempt.caseId) : null
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Format time spent
  const formatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const handleDeleteAttempt = async () => {
    if (window.confirm("Are you sure you want to delete this attempt? This action cannot be undone.")) {
      setIsDeleting(true);
      const success = await deleteAttempt(attemptId);
      
      if (success) {
        router.push('/attempts');
      } else {
        setIsDeleting(false);
        alert("Failed to delete attempt. Please try again.");
      }
    }
  }
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading attempt...</span>
      </div>
    )
  }
  
  if (!attempt || !caseItem) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Attempt not found</p>
        <Link href="/attempts">
          <Button className="mt-4">Back to Attempts</Button>
        </Link>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/attempts">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Attempts
          </Button>
        </Link>
      </div>
      
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              {attempt.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {caseItem.title} - {caseItem.species}
            </p>
          </div>
          
          <Badge
            className={`text-sm py-1 px-3 ${
              attempt.completionStatus === "completed"
                ? "bg-green-500"
                : attempt.completionStatus === "in_progress"
                  ? "bg-amber-500"
                  : "bg-red-500"
            } text-white`}
          >
            {attempt.completionStatus === "completed"
              ? "Completed"
              : attempt.completionStatus === "in_progress"
                ? "In Progress"
                : "Abandoned"}
          </Badge>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Created: {formatDate(attempt.createdAt)}</span>
          </div>
          {attempt.completedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Completed: {formatDate(attempt.completedAt)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Time spent: {formatTimeSpent(attempt.timeSpentSeconds)}</span>
          </div>
        </div>
      </header>
      
      <div className="flex justify-end mb-6">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteAttempt}
          disabled={isDeleting}
          className="flex items-center gap-2"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              Delete Attempt
            </>
          )}
        </Button>
      </div>
      
      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger 
            value="conversation" 
            activeTab={activeTab}
            onClick={setActiveTab}
          >
            Conversation
          </TabsTrigger>
          <TabsTrigger 
            value="feedback" 
            activeTab={activeTab}
            onClick={setActiveTab}
          >
            Feedback
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="conversation" activeTab={activeTab}>
          {messages.length > 0 ? (
            <div className="border rounded-lg p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`p-4 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary/10 ml-12' 
                    : 'bg-muted mr-12'
                }`}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{message.displayRole || message.role}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 border rounded-lg">
              No conversation history available for this attempt.
            </p>
          )}
        </TabsContent>
        
        <TabsContent value="feedback" activeTab={activeTab}>
          {feedback.length > 0 || attempt.overallFeedback ? (
            <div className="space-y-6">
              {/* Stage-specific feedback */}
              {feedback.map((item) => {
                const stageName = stages[item.stageIndex]?.title || `Stage ${item.stageIndex + 1}`
                
                return (
                  <div key={item.id} className="border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2">{stageName} Feedback</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: item.feedbackContent }} />
                    </div>
                  </div>
                )
              })}
              
              {/* Overall feedback */}
              {attempt.overallFeedback && (
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Overall Assessment</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: attempt.overallFeedback }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 border rounded-lg">
              No feedback available for this attempt.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
