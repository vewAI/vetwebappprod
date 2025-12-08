"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AudioDeviceSummary = {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
};

type AudioSettingsContextValue = {
  inputDevices: AudioDeviceSummary[];
  outputDevices: AudioDeviceSummary[];
  selectedInputId: string | null;
  setSelectedInputId: (deviceId: string | null) => void;
  selectedOutputId: string | null;
  setSelectedOutputId: (deviceId: string | null) => void;
  refreshDevices: () => Promise<void>;
  requestInputStream: () => Promise<MediaStream | null>;
  releaseInputStream: () => void;
};

const AudioSettingsContext = createContext<AudioSettingsContextValue | undefined>(
  undefined
);

const INPUT_STORAGE_KEY = "audio:selectedInputDevice";
const OUTPUT_STORAGE_KEY = "audio:selectedOutputDevice";

const stopStream = (stream: MediaStream | null) => {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Failed to stop media track", err);
      }
    });
  } catch (err) {
    console.warn("Failed to stop media stream", err);
  }
};

export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const [inputDevices, setInputDevices] = useState<AudioDeviceSummary[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceSummary[]>([]);
  const [selectedInputId, setSelectedInputIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(INPUT_STORAGE_KEY);
    }
  );
  const [selectedOutputId, setSelectedOutputIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(OUTPUT_STORAGE_KEY);
    }
  );

  const inputStreamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setInputDevices([]);
      setOutputDevices([]);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDeviceSummary[] = [];
      const outputs: AudioDeviceSummary[] = [];
      let anonymousInputCount = 1;
      let anonymousOutputCount = 1;
      devices.forEach((device) => {
        const base: AudioDeviceSummary = {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label?.trim() || "",
        };
        if (device.kind === "audioinput") {
          inputs.push({
            ...base,
            label:
              base.label || `Microphone ${anonymousInputCount++}`,
          });
        } else if (device.kind === "audiooutput") {
          outputs.push({
            ...base,
            label:
              base.label || `Speaker ${anonymousOutputCount++}`,
          });
        }
      });
      setInputDevices(inputs);
      setOutputDevices(outputs);

      if (!selectedInputId) {
        const firstInput = inputs[0];
        if (firstInput) {
          setSelectedInputIdState(firstInput.deviceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(INPUT_STORAGE_KEY, firstInput.deviceId);
          }
        }
      } else if (inputs.length > 0) {
        const stillExists = inputs.some(
          (device) => device.deviceId === selectedInputId
        );
        if (!stillExists) {
          const fallback = inputs[0];
          setSelectedInputIdState(fallback.deviceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              INPUT_STORAGE_KEY,
              fallback.deviceId
            );
          }
        }
      }

      if (!selectedOutputId) {
        const firstOutput = outputs[0];
        if (firstOutput) {
          setSelectedOutputIdState(firstOutput.deviceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              OUTPUT_STORAGE_KEY,
              firstOutput.deviceId
            );
          }
        }
      } else if (outputs.length > 0) {
        const stillExists = outputs.some(
          (device) => device.deviceId === selectedOutputId
        );
        if (!stillExists) {
          const fallback = outputs[0];
          setSelectedOutputIdState(fallback.deviceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              OUTPUT_STORAGE_KEY,
              fallback.deviceId
            );
          }
        }
      }
    } catch (err) {
      console.warn("Failed to enumerate media devices", err);
    }
  }, [selectedInputId, selectedOutputId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }
    void refreshDevices();
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [refreshDevices]);

  const setSelectedInputId = useCallback((deviceId: string | null) => {
    setSelectedInputIdState(deviceId);
    if (typeof window !== "undefined") {
      if (deviceId) {
        window.localStorage.setItem(INPUT_STORAGE_KEY, deviceId);
      } else {
        window.localStorage.removeItem(INPUT_STORAGE_KEY);
      }
    }
    if (inputStreamRef.current) {
      stopStream(inputStreamRef.current);
      inputStreamRef.current = null;
    }
  }, []);

  const setSelectedOutputId = useCallback((deviceId: string | null) => {
    setSelectedOutputIdState(deviceId);
    if (typeof window !== "undefined") {
      if (deviceId) {
        window.localStorage.setItem(OUTPUT_STORAGE_KEY, deviceId);
      } else {
        window.localStorage.removeItem(OUTPUT_STORAGE_KEY);
      }
    }
  }, []);

  const requestInputStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      console.warn("Media devices not available in this environment");
      return null;
    }
    try {
      const trackSettings =
        inputStreamRef.current?.getAudioTracks()?.[0]?.getSettings() ?? null;
      const currentDeviceId = trackSettings?.deviceId ?? null;
      if (
        inputStreamRef.current &&
        (!selectedInputId || currentDeviceId === selectedInputId)
      ) {
        return inputStreamRef.current;
      }
      if (inputStreamRef.current) {
        stopStream(inputStreamRef.current);
        inputStreamRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        audio: selectedInputId
          ? {
              deviceId: { exact: selectedInputId },
              noiseSuppression: true,
              echoCancellation: true,
            }
          : {
              noiseSuppression: true,
              echoCancellation: true,
            },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      inputStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn("Failed to acquire input stream", err);
      return null;
    }
  }, [selectedInputId]);

  const releaseInputStream = useCallback(() => {
    if (inputStreamRef.current) {
      stopStream(inputStreamRef.current);
      inputStreamRef.current = null;
    }
  }, []);

  const value = useMemo<AudioSettingsContextValue>(
    () => ({
      inputDevices,
      outputDevices,
      selectedInputId,
      setSelectedInputId,
      selectedOutputId,
      setSelectedOutputId,
      refreshDevices,
      requestInputStream,
      releaseInputStream,
    }),
    [
      inputDevices,
      outputDevices,
      selectedInputId,
      selectedOutputId,
      setSelectedInputId,
      setSelectedOutputId,
      refreshDevices,
      requestInputStream,
      releaseInputStream,
    ]
  );

  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings() {
  const ctx = useContext(AudioSettingsContext);
  if (!ctx) {
    throw new Error("useAudioSettings must be used within an AudioSettingsProvider");
  }
  return ctx;
}
