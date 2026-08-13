"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../types";

const HIDDEN_PATTERNS = ["[SYS_TRIGGER]", "[The veterinarian has just arrived"];

type LiveTranscriptProps = {
  entries: TranscriptEntry[];
  personaName: string;
  isOpen: boolean;
};

function isHiddenEntry(text: string): boolean {
  return HIDDEN_PATTERNS.some((pattern) => text.includes(pattern));
}

export function LiveTranscript({ entries, personaName, isOpen }: LiveTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const visibleEntries = entries.filter((entry) => !isHiddenEntry(entry.text));

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleEntries.length]);

  if (!isOpen) return null;

  return (
    <section
      aria-label="Conversation transcript"
      className="mx-3 mb-2 flex min-h-32 max-h-[30vh] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20 sm:mx-4"
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversation
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {visibleEntries.length} {visibleEntries.length === 1 ? "message" : "messages"}
        </span>
      </div>

      <div ref={transcriptRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visibleEntries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Waiting for conversation...
          </p>
        ) : (
          visibleEntries.map((entry) => {
            const isUser = entry.speaker === "user";
            return (
              <article
                key={entry.id}
                className={`rounded-md border px-3 py-2 ${
                  isUser
                    ? "border-primary/20 bg-primary/10"
                    : "border-border bg-background/60"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className={isUser ? "font-semibold text-primary" : "font-semibold text-foreground"}>
                    {isUser ? "You" : personaName}
                  </span>
                  <time className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {entry.text}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
