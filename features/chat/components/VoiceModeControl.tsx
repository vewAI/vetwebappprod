import React from "react";
import { Mic } from "lucide-react";

export type VoiceModeControlProps = {
  voiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export const VoiceModeControl: React.FC<VoiceModeControlProps> = ({ voiceMode, isListening, isSpeaking, onToggle, disabled }) => {
  const stateLabel = isListening ? "Listening" : isSpeaking ? "Speaking" : "Idle";
  return (
    <div id="voice-mode-control" role="group" aria-labelledby="voice-mode-control-status" className="flex flex-col items-center gap-2" data-testid="voice-mode-control">
      <button
        type="button"
        data-testid="voice-mode-toggle"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={voiceMode}
        aria-label={voiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
        className={`h-14 w-14 flex items-center justify-center rounded-full shadow-lg transition-transform transform ${voiceMode ? "scale-105" : ""} text-white bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400`}
      >
        <Mic className="h-6 w-6" />
      </button>
      {/* Screen-reader friendly status (announced politely) */}
      <div id="voice-mode-control-status" className="sr-only" aria-live="polite">{stateLabel}</div>
      <div className="text-sm text-muted-foreground" aria-hidden="true">{stateLabel}</div>
    </div>
  );
};

export default VoiceModeControl;
