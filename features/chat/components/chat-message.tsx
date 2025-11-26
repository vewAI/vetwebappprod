import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/features/chat/models/chat";
import { useEffect, useState } from "react";
import type { Stage } from "@/features/stages/types";

type ChatMessageProps = {
  message: Message;
  stages: Stage[];
  onRetry?: (id: string) => void;
};

export function ChatMessage({ message, stages, onRetry }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    const date = new Date(message.timestamp);
    setFormattedTime(
      date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [message.timestamp]);

  // Use displayRole if available, otherwise fall back to the previous logic
  let roleName = message.displayRole || (isUser ? "You" : "Virtual Examiner");

  if (
    !message.displayRole &&
    !isUser &&
    message.role === "assistant" &&
    message.stageIndex !== undefined
  ) {
    if (message.stageIndex >= 0 && message.stageIndex < stages.length) {
      roleName = stages[message.stageIndex].role;
    }
  }

  // Trim any trailing parenthetical remarks from role names, e.g.:
  // "Horse Owner (Female, initially worried...)" -> "Horse Owner"
  roleName = roleName.replace(/\s*\(.*\)\s*$/, "");

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-4",
        isUser ? "bg-muted/50" : "bg-background"
      )}
    >
      {message.portraitUrl && !isUser ? (
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border bg-muted">
          <img
            src={message.portraitUrl}
            alt={`${roleName} portrait`}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {isUser ? (
            <User className="h-5 w-5" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </div>
      )}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="font-medium">{roleName}</div>
          <div className="text-xs text-muted-foreground">{formattedTime}</div>
          {isUser && message.status === "failed" && (
            <button
              className="ml-2 text-xs text-red-600 hover:underline"
              onClick={() => onRetry && onRetry(message.id)}
            >
              Retry
            </button>
          )}
          {isUser && message.status === "pending" && (
            <div className="ml-2 text-xs text-muted-foreground">Sending…</div>
          )}
          {isUser && message.status === "sent" && (
            <div className="ml-2 text-xs text-muted-foreground">Sent</div>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
      </div>
    </div>
  );
}
