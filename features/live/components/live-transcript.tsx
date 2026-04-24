"use client";

import { useRef, useEffect } from "react";
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
      className="max-h-40 overflow-y-auto px-4 py-2 space-y-1 bg-muted/20 border-t border-border"
    >
      {entries.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-2">
          Speak to see the transcript...
        </p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 text-xs leading-relaxed">
            <span className={
              entry.speaker === "user"
                ? "text-primary font-semibold shrink-0"
                : "text-muted-foreground font-medium shrink-0"
            }>
              {entry.speaker === "user" ? "You:" : `${personaName}:`}
            </span>
            <span className={entry.speaker === "user" ? "text-foreground" : "text-muted-foreground"}>
              {entry.text}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
