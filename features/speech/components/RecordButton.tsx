"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Trash2 } from "lucide-react"
import { useSTT } from "../hooks/useSTT"
import { canStartListening } from "../services/sttService";
import { useSpeechDevices } from "@/features/speech/context/audio-device-context"

interface RecordButtonProps {
  onTranscriptChange?: (text: string) => void;
  className?: string;
}

export function RecordButton({ onTranscriptChange, className = "" }: RecordButtonProps) {
  const { selectedInputId } = useSpeechDevices();
  const { 
    start, 
    stop, 
    reset,
    transcript, 
    interimTranscript,
    isListening 
  } = useSTT(undefined, 700, { inputDeviceId: selectedInputId });
  
  // Handle toggling recording state
  const toggleRecording = () => {
    if (isListening) {
      stop();
      // If we have a callback, send the final transcript
      if (onTranscriptChange && transcript) {
        onTranscriptChange(transcript);
      }
    } else {
      try {
        if (!canStartListening()) return;
      } catch (e) {
        // fallback to allow user-initiated start if helper fails
      }
      start();
    }
  };
  
  // Handle clearing the transcript
  const clearTranscript = () => {
    reset();
    if (onTranscriptChange) {
      onTranscriptChange("");
    }
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2">
        <Button
          type="button"
          variant={isListening ? "destructive" : "secondary"}
          size="sm"
          onClick={toggleRecording}
          className={`flex items-center ${className}`}
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" />
              Record
            </>
          )}
        </Button>
        
        {transcript && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearTranscript}
            className="flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
      
      {/* Display the transcript */}
      {(transcript || interimTranscript) && (
        <div className="p-3 bg-muted rounded-md text-sm">
          {transcript}
          <span className="text-muted-foreground">{interimTranscript}</span>
        </div>
      )}
    </div>
  );
}
