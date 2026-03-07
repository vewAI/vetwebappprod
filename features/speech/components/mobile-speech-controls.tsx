"use client";

import React from "react";
import { Mic, MicOff, Speaker } from "lucide-react";
import { useSTT } from "../hooks/useSTT";
import { canStartListening } from "../services/sttService";
import { stopActiveTtsPlayback } from "../services/ttsService";

export default function MobileSpeechControls() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsMobile(/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua));
  }, []);

  const { start, stop, isListening } = useSTT(undefined, 700, {});

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-3">
      <div className="flex flex-col items-end space-y-2">
        <button
          aria-label={isListening ? "Stop recording" : "Start recording"}
          onClick={() => {
            if (isListening) stop();
            else {
              try {
                if (!canStartListening()) return;
              } catch (e) {
                // fallback
              }
              start();
            }
          }}
          className="h-14 w-14 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center touch-none active:scale-95"
        >
          {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        <button
          aria-label="Stop TTS playback"
          onClick={() => stopActiveTtsPlayback()}
          className="h-10 px-3 rounded-full bg-muted text-white shadow-md flex items-center justify-center text-sm"
        >
          <Speaker className="h-4 w-4 mr-2" />
          Stop TTS
        </button>
      </div>
    </div>
  );
}
