"use client";

import { useRef, useEffect, useState } from "react";
import type { TranscriptEntry } from "../types";

type LiveTranscriptProps = {
  entries: TranscriptEntry[];
  personaName: string;
  isOpen: boolean;
};

export function LiveTranscript({ entries, personaName, isOpen }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleEntry, setVisibleEntry] = useState<TranscriptEntry | null>(null);
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show entries one at a time with enough time to read
  useEffect(() => {
    if (entries.length === 0) {
      setVisibleEntry(null);
      return;
    }

    const latest = entries[entries.length - 1];

    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If same entry is already showing, skip
    if (visibleEntry?.id === latest.id) return;

    setIsFading(false);
    setVisibleEntry(latest);

    // Estimate reading time: ~50ms per character, min 3s, max 12s
    const readTime = Math.max(3000, Math.min(12000, latest.text.length * 50));
    timerRef.current = setTimeout(() => {
      setIsFading(true);
    }, readTime);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [entries]);

  if (!isOpen) return null;

  const latest = entries[entries.length - 1];

  return (
    <div
      ref={containerRef}
      className="h-9 flex items-center px-4 bg-muted/20 border-t border-border overflow-hidden"
    >
      {latest ? (
        <div
          className={`flex items-center gap-2 text-sm transition-opacity duration-500 whitespace-nowrap ${
            isFading ? "opacity-40" : "opacity-100"
          }`}
        >
          <span className={
            latest.speaker === "user"
              ? "text-primary font-semibold shrink-0"
              : "text-muted-foreground font-medium shrink-0"
          }>
            {latest.speaker === "user" ? "You:" : `${personaName}:`}
          </span>
          <span className={latest.speaker === "user" ? "text-foreground" : "text-muted-foreground"}>
            {latest.text}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Speak to see the transcript...
        </p>
      )}
    </div>
  );
}
