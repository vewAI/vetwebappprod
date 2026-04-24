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
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [entries, isOpen]);

  if (!isOpen) return null;

  const text = entries.map((e) => (e.speaker === "user" ? "You" : personaName) + ": " + e.text).join("  •  ");

  return (
    <div className="px-4 py-2">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm text-muted-foreground scrollbar-none"
      >
        {entries.length === 0 ? (
          <span>Transcript will appear here...</span>
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  );
}
