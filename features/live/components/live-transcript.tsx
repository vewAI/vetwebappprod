"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "../types";

type LiveTranscriptProps = {
  entries: TranscriptEntry[];
  personaName: string;
  isOpen: boolean;
};

export function LiveTranscript({ entries, personaName, isOpen }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-muted/30"
    >
      {entries.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Conversation transcript will appear here
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
            entry.speaker === "user"
              ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
        >
          <p className="text-xs font-medium opacity-70 mb-0.5">
            {entry.speaker === "user" ? "You" : personaName}
          </p>
          <p>{entry.text}</p>
        </div>
      ))}
    </div>
  );
}
