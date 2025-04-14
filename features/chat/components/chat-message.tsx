import { User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/features/chat/models/chat"
import { useEffect, useState } from "react"
import type { Stage } from "@/features/stages/types"

type ChatMessageProps = {
  message: Message
  stages: Stage[] 
}

export function ChatMessage({ message, stages }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [formattedTime, setFormattedTime] = useState<string>("")
  
  useEffect(() => {
    const date = new Date(message.timestamp)
    setFormattedTime(
      date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    )
  }, [message.timestamp])

  // Use displayRole if available, otherwise fall back to the previous logic
  let roleName = message.displayRole || (isUser ? "You" : "Virtual Examiner")
  
  if (!message.displayRole && !isUser && message.role === "assistant" && message.stageIndex !== undefined) {
    if (message.stageIndex >= 0 && message.stageIndex < stages.length) {
      roleName = stages[message.stageIndex].role
    }
  }
  
  return (
    <div className={cn("flex items-start gap-3 rounded-lg p-4", isUser ? "bg-muted/50" : "bg-background")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="font-medium">{roleName}</div>
          <div className="text-xs text-muted-foreground">
            {formattedTime}
          </div>
        </div>
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
      </div>
    </div>
  )
}
