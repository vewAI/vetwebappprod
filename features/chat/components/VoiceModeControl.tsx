import React from "react";

export type VoiceModeControlProps = {
  voiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export const VoiceModeControl: React.FC<VoiceModeControlProps> = ({ voiceMode, isListening, isSpeaking, onToggle, disabled }) => {
  const label = voiceMode ? "Voice Mode: On" : "Voice Mode: Off";
  const stateLabel = isListening ? "Listening" : isSpeaking ? "Speaking" : "Idle";
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={voiceMode}
        className={`px-4 py-2 rounded-md text-white ${voiceMode ? "bg-red-500" : "bg-gray-500"}`}
      >
        {label}
      </button>
      <div className="text-xs text-muted-foreground">{stateLabel}</div>
    </div>
  );
};

export default VoiceModeControl;
