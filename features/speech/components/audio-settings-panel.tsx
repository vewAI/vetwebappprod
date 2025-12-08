"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useAudioSettings } from "@/features/speech/context/audio-settings";
import { RefreshCw, X } from "lucide-react";

type AudioSettingsPanelProps = {
  onClose?: () => void;
};

const selectClassName =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function AudioSettingsPanel({ onClose }: AudioSettingsPanelProps) {
  const {
    inputDevices,
    outputDevices,
    selectedInputId,
    setSelectedInputId,
    selectedOutputId,
    setSelectedOutputId,
    refreshDevices,
  } = useAudioSettings();

  const hasInputs = inputDevices.length > 0;
  const hasOutputs = outputDevices.length > 0;

  return (
    <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Audio preferences</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              void refreshDevices();
            }}
            title="Refresh devices"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            title="Close audio settings"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-4 text-sm">
        <div>
          <label className="font-medium">Microphone</label>
          <select
            className={selectClassName}
            value={selectedInputId ?? ""}
            onChange={(event) => {
              const next = event.target.value || null;
              setSelectedInputId(next);
            }}
            disabled={!hasInputs}
          >
            {hasInputs ? null : <option value="">No microphones found</option>}
            {inputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {!hasInputs && (
            <p className="mt-1 text-xs text-muted-foreground">
              If devices are missing, grant microphone permission in your browser
              and click refresh.
            </p>
          )}
        </div>

        <div>
          <label className="font-medium">Playback device</label>
          <select
            className={selectClassName}
            value={selectedOutputId ?? ""}
            onChange={(event) => {
              const next = event.target.value || null;
              setSelectedOutputId(next);
            }}
            disabled={!hasOutputs}
          >
            {hasOutputs ? null : <option value="">Default system output</option>}
            {hasOutputs && (
              <option value="">Use system default</option>
            )}
            {outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {!hasOutputs && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your browser may require a recent version to select an output
              device. Audio will use the system default when no device is chosen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
