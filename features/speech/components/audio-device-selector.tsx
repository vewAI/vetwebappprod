"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeechDevices } from "@/features/speech/context/audio-device-context";

type AudioDeviceSelectorProps = {
  className?: string;
};

export function AudioDeviceSelector({ className }: AudioDeviceSelectorProps) {
  const {
    inputDevices,
    outputDevices,
    selectedInputId,
    selectedOutputId,
    setSelectedInputId,
    setSelectedOutputId,
    refreshDevices,
    requestPermission,
    labelsAvailable,
    permissionError,
    isEnumerating,
    isSupported,
  } = useSpeechDevices();

  if (!isSupported) {
    return null;
  }

  const hasDevices = inputDevices.length > 0 || outputDevices.length > 0;
  const micValue = selectedInputId ?? inputDevices[0]?.deviceId ?? "";
  const speakerValue = selectedOutputId ?? outputDevices[0]?.deviceId ?? "";

  const handleInputChange = (value: string) => {
    const next = value === "" ? null : value;
    setSelectedInputId(next);
  };

  const handleOutputChange = (value: string) => {
    const next = value === "" ? null : value;
    setSelectedOutputId(next);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/40 p-2 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-foreground">
        <span className="text-xs font-semibold shrink-0">Audio:</span>
        
        {!hasDevices ? (
          <span className="text-xs text-muted-foreground">
            {permissionError || "No devices. Click Allow access."}
          </span>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {inputDevices.length > 0 && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Mic</span>
                <select
                  className="h-6 w-full max-w-[120px] rounded border border-border bg-background px-1 text-xs"
                  value={micValue}
                  onChange={(event) => handleInputChange(event.target.value)}
                >
                  {inputDevices.map((device) => (
                    <option key={`${device.kind}-${device.deviceId}`} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {outputDevices.length > 0 && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Spk</span>
                <select
                  className="h-6 w-full max-w-[120px] rounded border border-border bg-background px-1 text-xs"
                  value={speakerValue}
                  onChange={(event) => handleOutputChange(event.target.value)}
                >
                  {outputDevices.map((device) => (
                    <option key={`${device.kind}-${device.deviceId}`} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => void refreshDevices()}
            disabled={isEnumerating}
            title="Refresh devices"
          >
            <span className="sr-only">Refresh</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isEnumerating ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16l5 5v-5" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => void requestPermission()}
          >
            Allow access
          </Button>
        </div>
      </div>

      {!labelsAvailable && hasDevices && (
        <p className="mt-1 text-[10px]">
          Device names generic until permission granted.
        </p>
      )}

      {permissionError && (
        <p className="mt-1 text-[10px] text-destructive">{permissionError}</p>
      )}
    </div>
  );
}
