"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeechDevices } from "@/features/speech/context/audio-device-context";
import { Mic, RefreshCw, Speaker } from "lucide-react";

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
    <div className={cn("rounded-lg border border-border/70 bg-muted/40 p-2 text-xs text-muted-foreground", className)}>
      <div className="flex flex-wrap items-center gap-3 text-foreground">
        {!hasDevices ? (
          <span className="text-xs text-muted-foreground">{permissionError || "No devices. Click Allow access."}</span>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {inputDevices.length > 0 && (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Mic className="w-4 h-4 text-muted-foreground" aria-hidden="true" />

                <select
                  className="h-6 w-full rounded border border-border bg-background px-1 text-xs"
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
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Speaker className="w-4 h-4 text-muted-foreground" aria-hidden="true" />

                <select
                  className="h-6 w-full rounded border border-border bg-background px-1 text-xs"
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
            <RefreshCw className={isEnumerating ? "w-3 h-3 animate-spin" : "w-3 h-3"} aria-hidden="true" />
          </Button>
          {(!labelsAvailable || permissionError) && (
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => void requestPermission()}>
              Allow access
            </Button>
          )}
        </div>
      </div>

      {!labelsAvailable && hasDevices && <p className="mt-1 text-[10px]">Device names generic until permission granted.</p>}

      {permissionError && <p className="mt-1 text-[10px] text-destructive">{permissionError}</p>}
    </div>
  );
}
