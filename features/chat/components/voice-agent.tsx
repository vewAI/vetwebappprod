"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Play, Pause } from "lucide-react";
import { useSTT } from "@/features/speech/hooks/useSTT";
import { useTTS } from "@/features/speech/hooks/useTTS";
import { getFallbackAvatarProfiles, fetchAvatarProfiles } from "@/features/avatar/services/avatarConfigService";
import { chatService } from "@/features/chat/services/chatService";
import { useAuth } from "@/features/auth/services/authService";

type VoiceAgentProps = {
  caseId?: string;
  stageIndex?: number;
};

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ caseId = "case-1", stageIndex = 0 }) => {
  const { speakAsync, available: ttsAvailable, cancel: cancelTts } = useTTS();
  const { start, stop, transcript, interimTranscript, isListening, error } = useSTT(onFinal);
  const [history, setHistory] = useState<string[]>([]);
  const [assistantReply, setAssistantReply] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const { user } = useAuth();

  // Avatar profile (fetch case avatars and prefer a nurse image like "Martin Lambert")
  const [avatarProfile, setAvatarProfile] = useState<any>(() => {
    const list = getFallbackAvatarProfiles(caseId);
    return list.find((p) => p.roleKey === "assistant") ?? list[0];
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAvatarProfiles(caseId);
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        // Prefer nurse/name via helper
        const { choosePreferredAvatar } = await import("@/features/chat/utils/avatar");
        const preferred = choosePreferredAvatar(list as any);
        setAvatarProfile(preferred);
      } catch (e) {
        // ignore and keep fallback profile
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Handler invoked by useSTT when a final transcript chunk is ready
  async function onFinal(text: string) {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    setHistory((h) => [...h.slice(-20), trimmed]);
    if (!autoSend) return;
    try {
      const msg = chatService.createUserMessage(trimmed, stageIndex);
      const resp = await chatService.sendMessage([msg], stageIndex, caseId);
      const content = resp?.content ?? "";
      setAssistantReply(content);
      if (ttsAvailable) {
        setIsSpeaking(true);
        try {
          await speakAsync(content);
        } catch (e) {
          console.warn("TTS failed (voice-agent):", e);
        } finally {
          setIsSpeaking(false);
        }
      }
    } catch (e) {
      console.error("VoiceAgent send failed:", e);
    }
  }

  // start/stop wrappers
  const toggleListening = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  // Play last assistant reply with TTS
  const playReply = useCallback(async () => {
    if (!assistantReply || !ttsAvailable) return;
    setIsSpeaking(true);
    try {
      await speakAsync(assistantReply);
    } catch (e) {
      console.warn("TTS play failed:", e);
    } finally {
      setIsSpeaking(false);
    }
  }, [assistantReply, speakAsync, ttsAvailable]);

  const stopReply = useCallback(() => {
    try {
      cancelTts();
    } finally {
      setIsSpeaking(false);
    }
  }, [cancelTts]);

  useEffect(() => {
    // Clean-up on unmount
    return () => {
      try {
        stop();
      } catch {}
    };
  }, [stop]);

  return (
    <div className="p-6 max-w-xl mx-auto bg-muted rounded-md shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center bg-gray-200" style={{ background: avatarProfile?.primaryColor ?? "hsl(210 60% 50%)" }}>
              {(() => {
                const imgUrl = isSpeaking ? (avatarProfile?.assetUrl ?? avatarProfile?.idleAssetUrl) : (avatarProfile?.idleAssetUrl ?? avatarProfile?.assetUrl);
                if (imgUrl) {
                  // eslint-disable-next-line @next/next/no-img-element
                  return <img src={imgUrl} alt={avatarProfile?.displayName ?? "avatar"} className="h-full w-full object-cover" />;
                }
                return (
                  <span className="text-white font-semibold">
                    {avatarProfile?.displayName?.split(" ").map((s: string) => s[0]).join("").slice(0, 2) ?? "VA"}
                  </span>
                );
              })()}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">{avatarProfile?.displayName ?? "Virtual Assistant"}</div>
            <div className="text-xs text-muted-foreground">Assistant · Speak to the agent and it will reply aloud</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-muted-foreground mr-2">Auto-send</label>
          <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
        </div>
      </div> 

      <div className="mt-4 flex items-center justify-center">
        <Button
          size="lg"
          variant={isListening ? "destructive" : "default"}
          onClick={toggleListening}
          className="flex items-center gap-2 px-6 py-2 text-md"
          aria-pressed={isListening}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} {isListening ? "Listening..." : "Speak"}
        </Button>
      </div>

      <div className="mt-4 p-4 bg-muted rounded-md border border-gray-700">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Live transcript</div>
        <div className="text-sm min-h-[48px] text-white">{interimTranscript || transcript || <span className="text-muted-foreground">(say something)</span>}</div>
        {error && <div className="text-xs text-destructive mt-2">STT error: {error}</div>}
      </div>

      <div className="mt-4 p-4 bg-muted rounded-md border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Assistant Reply</div>
          <div>
            <Button size="sm" variant="ghost" onClick={playReply} disabled={!assistantReply || isSpeaking} className="mr-2" aria-label="Play reply"><Play className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={stopReply} disabled={!assistantReply || !isSpeaking} aria-label="Stop reply"><Pause className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-2 text-sm min-h-[48px]">{assistantReply ?? <span className="text-muted-foreground">(assistant will speak here)</span>}</div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">Recent requests</div>
      <ul className="mt-2 list-disc list-inside text-sm">
        {history.slice().reverse().slice(0, 6).map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
    </div>
  );
};
