"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Award, X, Home, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

interface CompletionDialogProps {
  isOpen: boolean
  onClose: () => void
  feedback: string
  isLoading: boolean
  caseId: string
}

export function CompletionDialog({ 
  isOpen, 
  onClose, 
  feedback, 
  isLoading, 
  caseId 
}: CompletionDialogProps) {
  const router = useRouter()
  
  const handleReturnHome = () => {
    router.push('/')
  }
  
  const handleRestartCase = () => {
    router.push(`/case-${caseId}?reset=true`)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Award className="h-6 w-6 text-amber-500 mr-2" />
              <div>
                <h2 className="text-xl font-semibold">Examination Complete!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Comprehensive feedback on your performance
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <span className="text-center">Generating your comprehensive feedback...</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md text-center">
                This may take a moment as we analyse your performance across all stages.
              </p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: feedback }} />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6 pt-4 border-t">
            <Button
              onClick={handleReturnHome}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Return to Cases
            </Button>
            <Button
              onClick={handleRestartCase}
              className="flex items-center gap-2 bg-gradient-to-l from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 border-none"
            >
              <RefreshCw className="h-4 w-4" />
              Restart This Case
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
