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
        "rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
        <span className="text-sm font-semibold">Audio devices</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void refreshDevices()}
            disabled={isEnumerating}
          >
            {isEnumerating ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void requestPermission()}
          >
            Allow access
          </Button>
        </div>
      </div>

      {!hasDevices && (
        <p className="mt-2">
          {permissionError ||
            "No audio devices available yet. Click “Allow access” if the browser is blocking the microphone list."}
        </p>
      )}

      {hasDevices && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {inputDevices.length > 0 && (
            <label className="flex flex-col gap-1 text-foreground">
              <span className="font-medium">Microphone</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                value={micValue}
                onChange={(event) => handleInputChange(event.target.value)}
              >
                {inputDevices.map((device) => (
                  <option key={`${device.kind}-${device.deviceId}`} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {outputDevices.length > 0 && (
            <label className="flex flex-col gap-1 text-foreground">
              <span className="font-medium">Speaker</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                value={speakerValue}
                onChange={(event) => handleOutputChange(event.target.value)}
              >
                {outputDevices.map((device) => (
                  <option key={`${device.kind}-${device.deviceId}`} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {!labelsAvailable && hasDevices && (
        <p className="mt-2 text-[11px]">
          Device names stay generic until you grant microphone permission. Use the buttons above if you need specific labels.
        </p>
      )}

      {permissionError && (
        <p className="mt-2 text-[11px] text-destructive">{permissionError}</p>
      )}
    </div>
  );
}
