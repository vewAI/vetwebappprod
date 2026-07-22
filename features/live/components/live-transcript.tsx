"use client";

import { useRef, useEffect } from "react";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { ChatMessage } from "@/features/chat/components/chat-message";

const HIDDEN_PATTERNS = ["[SYS_TRIGGER]", "[The veterinarian has just arrived"];

function isHiddenEntry(content: string): boolean {
  return HIDDEN_PATTERNS.some((p) => content.includes(p));
}

type LiveTranscriptProps = {
  messages: Message[];
  isOpen: boolean;
  stages: Stage[];
  /** Filter messages to show only those matching this persona role key (plus user messages always). */
  filterPersona?: string | null;
};

export function LiveTranscript({
  messages,
  isOpen,
  stages,
  filterPersona,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Filter: user messages always visible; persona messages filtered by filterPersona
  const filteredMessages = filterPersona
    ? messages.filter(
        (m) =>
          !isHiddenEntry(m.content) &&
          (m.role === "user" || m.personaRoleKey === filterPersona)
      )
    : messages.filter((m) => !isHiddenEntry(m.content));

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 100px from bottom, pause auto-scroll
    shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0"
    >
      {filteredMessages.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Waiting for conversation...
        </p>
      ) : (
        filteredMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            stages={stages}
          />
        ))
      )}
    </div>
  );
}
