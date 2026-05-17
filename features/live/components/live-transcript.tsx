"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { TranscriptEntry } from "../types";

const HIDDEN_PATTERNS = ["[SYS_TRIGGER]", "[The veterinarian has just arrived"];

type LiveTranscriptProps = {
  entries: TranscriptEntry[];
  personaName: string;
  isOpen: boolean;
};

function isHiddenEntry(text: string): boolean {
  return HIDDEN_PATTERNS.some((p) => text.includes(p));
}

export function LiveTranscript({ entries, personaName, isOpen }: LiveTranscriptProps) {
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const lastShownIdRef = useRef<string | null>(null);

  // Filter hidden entries and show the latest visible one
  const visibleEntries = entries.filter((e) => !isHiddenEntry(e.text));
  const latestVisible = visibleEntries.length > 0 ? visibleEntries[visibleEntries.length - 1] : null;
  const isNewEntry = latestVisible && latestVisible.id !== lastShownIdRef.current;

  // When a new entry arrives, reset fade and update tracking
  useEffect(() => {
    if (!latestVisible) return;

    if (isNewEntry) {
      lastShownIdRef.current = latestVisible.id;
      setIsFading(false);

      if (timerRef.current) clearTimeout(timerRef.current);

      // Reading time: ~60ms per character, min 4s, max 15s
      const readTime = Math.max(4000, Math.min(15000, latestVisible.text.length * 60));
      timerRef.current = setTimeout(() => {
        setIsFading(true);
      }, readTime);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [latestVisible, isNewEntry]);

  if (!isOpen) return null;

  return (
    <div className="h-10 flex items-center px-4 bg-muted/30 border-t border-border">
      {latestVisible ? (
        <div
          className={`flex items-center gap-2 w-full transition-opacity duration-700 ${
            isFading ? "opacity-30" : "opacity-100"
          }`}
        >
          <span
            className={
              latestVisible.speaker === "user"
                ? "text-primary font-semibold shrink-0 text-sm"
                : "text-muted-foreground font-medium shrink-0 text-sm"
            }
          >
            {latestVisible.speaker === "user" ? "You:" : `${personaName}:`}
          </span>
          <span
            ref={textRef}
            className={`text-sm truncate ${
              latestVisible.speaker === "user"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {latestVisible.text}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Waiting for conversation...
        </p>
      )}
    </div>
  );
}
