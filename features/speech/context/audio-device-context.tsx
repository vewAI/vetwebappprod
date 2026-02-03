"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { setPreferredInputDevice, setPreferredOutputDevice } from "../services/deviceRegistry";

const INPUT_STORAGE_KEY = "speech:selected-input-device";
const OUTPUT_STORAGE_KEY = "speech:selected-output-device";

export type AudioDeviceOption = {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
};

type AudioDeviceContextValue = {
  inputDevices: AudioDeviceOption[];
  outputDevices: AudioDeviceOption[];
  selectedInputId: string | null;
  selectedOutputId: string | null;
  setSelectedInputId: (deviceId: string | null) => void;
  setSelectedOutputId: (deviceId: string | null) => void;
  refreshDevices: () => Promise<void>;
  requestPermission: () => Promise<void>;
  labelsAvailable: boolean;
  permissionError: string | null;
  isEnumerating: boolean;
  isSupported: boolean;
};

const defaultContextValue: AudioDeviceContextValue = {
  inputDevices: [],
  outputDevices: [],
  selectedInputId: null,
  selectedOutputId: null,
  setSelectedInputId: () => {},
  setSelectedOutputId: () => {},
  refreshDevices: async () => {},
  requestPermission: async () => {},
  labelsAvailable: false,
  permissionError: null,
  isEnumerating: false,
  isSupported: false,
};

const AudioDeviceContext = createContext<AudioDeviceContextValue>(defaultContextValue);

function persistSelection(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    const stores: (Storage | undefined)[] = [window.localStorage, window.sessionStorage];
    stores.forEach((store) => {
      if (!store) return;
      if (value) {
        store.setItem(key, value);
      } else {
        store.removeItem(key);
      }
    });
  } catch {
    // ignore storage failures
  }
}

function readStoredSelection(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function mapDeviceLabel(device: MediaDeviceInfo, index: number, fallbackPrefix: string, labelsAvailable: boolean): AudioDeviceOption {
  const suffix = labelsAvailable ? "" : " (allow access for names)";
  return {
    deviceId: device.deviceId || `${device.kind}-${index}`,
    label: device.label || `${fallbackPrefix} ${index + 1}${suffix}`,
    kind: device.kind,
  };
}

export function SpeechDeviceProvider({ children }: { children: ReactNode }) {
  const [inputDevices, setInputDevices] = useState<AudioDeviceOption[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedInputId, setSelectedInputIdState] = useState<string | null>(null);
  const [selectedOutputId, setSelectedOutputIdState] = useState<string | null>(null);
  const [labelsAvailable, setLabelsAvailable] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isEnumerating, setIsEnumerating] = useState<boolean>(false);

  const storedInputRef = useRef<string | null>(null);
  const storedOutputRef = useRef<string | null>(null);

  const isSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.enumerateDevices);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setInputDevices([]);
      setOutputDevices([]);
      setLabelsAvailable(false);
      return;
    }
    setIsEnumerating(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = devices.some((device) => Boolean(device.label));
      setLabelsAvailable(hasLabels);
      const inputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => mapDeviceLabel(device, index, "Microphone", hasLabels));
      const outputs = devices
        .filter((device) => device.kind === "audiooutput")
        .map((device, index) => mapDeviceLabel(device, index, "Speaker", true));
      setInputDevices(inputs);
      setOutputDevices(outputs);
      setPermissionError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to enumerate audio devices.";
      setPermissionError(message);
    } finally {
      setIsEnumerating(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermissionError("Browser does not support microphone access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionError(null);
      await refreshDevices();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Microphone permission denied.";
      setPermissionError(message);
    }
  }, [refreshDevices]);

  const setSelectedInputId = useCallback((deviceId: string | null) => {
    setSelectedInputIdState(deviceId);
    storedInputRef.current = deviceId;
    setPreferredInputDevice(deviceId);
    persistSelection(INPUT_STORAGE_KEY, deviceId);
  }, []);

  const setSelectedOutputId = useCallback((deviceId: string | null) => {
    setSelectedOutputIdState(deviceId);
    storedOutputRef.current = deviceId;
    setPreferredOutputDevice(deviceId);
    persistSelection(OUTPUT_STORAGE_KEY, deviceId);
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    storedInputRef.current = readStoredSelection(INPUT_STORAGE_KEY);
    storedOutputRef.current = readStoredSelection(OUTPUT_STORAGE_KEY);
    if (storedInputRef.current) {
      setSelectedInputIdState(storedInputRef.current);
      setPreferredInputDevice(storedInputRef.current);
    }
    if (storedOutputRef.current) {
      setSelectedOutputIdState(storedOutputRef.current);
      setPreferredOutputDevice(storedOutputRef.current);
    }
    void refreshDevices();
  }, [isSupported, refreshDevices]);

  useEffect(() => {
    if (!isSupported) return;
    const mediaDevices = navigator.mediaDevices;
    const handler = () => {
      void refreshDevices();
    };
    if (typeof mediaDevices.addEventListener === "function") {
      mediaDevices.addEventListener("devicechange", handler);
      return () => {
        mediaDevices.removeEventListener("devicechange", handler);
      };
    }
    const originalHandler = mediaDevices.ondevicechange;
    mediaDevices.ondevicechange = handler;
    return () => {
      if (mediaDevices.ondevicechange === handler) {
        mediaDevices.ondevicechange = originalHandler ?? null;
      }
    };
  }, [isSupported, refreshDevices]);

  useEffect(() => {
    if (!inputDevices.length) {
      if (selectedInputId !== null) {
        setSelectedInputId(null);
      }
      return;
    }
    setSelectedInputIdState((current) => {
      if (current && inputDevices.some((d) => d.deviceId === current)) {
        setPreferredInputDevice(current);
        return current;
      }
      const fallback =
        (storedInputRef.current && inputDevices.some((d) => d.deviceId === storedInputRef.current) && storedInputRef.current) ||
        inputDevices[0].deviceId;
      storedInputRef.current = fallback;
      setPreferredInputDevice(fallback);
      persistSelection(INPUT_STORAGE_KEY, fallback);
      return fallback;
    });
  }, [inputDevices, selectedInputId, setSelectedInputId]);

  useEffect(() => {
    if (!outputDevices.length) {
      if (selectedOutputId !== null) {
        setSelectedOutputId(null);
      }
      return;
    }
    setSelectedOutputIdState((current) => {
      if (current && outputDevices.some((d) => d.deviceId === current)) {
        setPreferredOutputDevice(current);
        return current;
      }
      const fallback =
        (storedOutputRef.current && outputDevices.some((d) => d.deviceId === storedOutputRef.current) && storedOutputRef.current) ||
        outputDevices[0].deviceId;
      storedOutputRef.current = fallback;
      setPreferredOutputDevice(fallback);
      persistSelection(OUTPUT_STORAGE_KEY, fallback);
      return fallback;
    });
  }, [outputDevices, selectedOutputId, setSelectedOutputId]);

  const value = useMemo<AudioDeviceContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  return <AudioDeviceContext.Provider value={value}>{children}</AudioDeviceContext.Provider>;
}

export function useSpeechDevices(): AudioDeviceContextValue {
  return useContext(AudioDeviceContext);
}
