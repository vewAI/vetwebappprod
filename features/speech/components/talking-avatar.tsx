"use client";

import React, { useEffect, useState } from "react";
import { useTtsAnalyser } from "@/features/speech/hooks/useTtsAnalyser";

export default function TalkingAvatar() {
  const { amplitude } = useTtsAnalyser();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerLabel, setSpeakerLabel] = useState<string | null>(null);
  const [colorSeed, setColorSeed] = useState<number>(0);

  useEffect(() => {
    function onStart(e: Event) {
      try {
        const detail = (e as CustomEvent).detail as
          | { audio?: HTMLAudioElement; role?: string; displayRole?: string }
          | undefined;
        const el = detail?.audio;
        const role = detail?.displayRole || detail?.role || null;
        setSpeakerLabel(role);
        setColorSeed(hashCode(String(role ?? Date.now())) % 360);
        setIsSpeaking(true);
        if (!el) return;
        const onStop = () => setIsSpeaking(false);
        el.addEventListener("ended", onStop);
        el.addEventListener("pause", onStop);
        // Cleanup
        const cleanup = () => {
          try {
            el.removeEventListener("ended", onStop);
            el.removeEventListener("pause", onStop);
          } catch (e) {}
        };
        // Ensure we clean up when a new TTS starts
        window.addEventListener("vw:tts-end-temp-cleanup", cleanup, {
          once: true,
        });
      } catch (e) {
        console.error("TalkingAvatar onStart error", e);
      }
    }

    window.addEventListener("vw:tts-start", onStart as EventListener);
    return () => {
      window.removeEventListener("vw:tts-start", onStart as EventListener);
    };
  }, []);

  // Map amplitude (0..1) to mouth open (0..1) with smoothing
  const mouthOpen = Math.max(0, Math.min(1, amplitude));

  // Simple deterministic color from seed
  const avatarColor = `linear-gradient(180deg,hsl(${colorSeed} 80% 70%) 0%, hsl(${
    (colorSeed + 30) % 360
  } 60% 60%) 100%)`;

  const rotateDeg = speakerLabel ? (hashCode(speakerLabel) % 11) - 5 : 0;

  return (
    <div
      aria-hidden
      className={`fixed right-6 bottom-6 z-50 pointer-events-none`}
      style={{ width: 120, height: 120 }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 9999,
          background: avatarColor,
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `rotate(${rotateDeg}deg)`,
          transition: "transform 220ms ease",
        }}
      >
        <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden>
          <defs>
            <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Simple head */}
          <circle
            cx="34"
            cy="30"
            r="24"
            fill="#fff"
            stroke="rgba(0,0,0,0.06)"
          />
          {/* Eyes */}
          <circle cx="24" cy="26" r="3.6" fill="#111827" />
          <circle cx="44" cy="26" r="3.6" fill="#111827" />
          {/* Mouth: scaleY based on amplitude */}
          <g transform={`translate(34,40)`}>
            <rect
              x={-14}
              y={-6}
              width={28}
              height={12}
              rx={8}
              fill="#111827"
              style={{
                transformOrigin: "center",
                transform: `scaleY(${0.25 + mouthOpen * 1.2})`,
                transition: "transform 80ms linear",
              }}
            />
          </g>
        </svg>
        {/* Label */}
        {speakerLabel && (
          <div
            style={{
              position: "absolute",
              bottom: -18,
              fontSize: 11,
              color: "#111827",
              background: "rgba(255,255,255,0.9)",
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            {speakerLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
