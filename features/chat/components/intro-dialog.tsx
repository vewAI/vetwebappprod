"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSpeechDevices } from "@/features/speech/context/audio-device-context";
import { AudioDeviceSelector } from "@/features/speech/components/audio-device-selector";
import { Checkbox } from "@/components/ui/checkbox";
import { Circle, CircleDot } from "lucide-react";

export type IntroDialogProps = {
  mounted: boolean;
  onClose: () => void;
  // onContinue receives the chosen mode and optional settings (e.g., autoSendStt)
  onContinue?: (mode: "voice" | "text", opts?: { autoSendStt?: boolean }) => void;
  className?: string;
};

export function IntroDialog({ mounted, onClose, onContinue, className }: IntroDialogProps) {
  // Internal flag used to differentiate user-initiated closes (Close/Continue)
  // from backdrop/ESC attempts. We only act when the user clicked our buttons.
  const internalCloseRequestedRef = useRef(false);

  useEffect(() => {
    return () => {
      internalCloseRequestedRef.current = false;
    };
  }, []);

  const { isSupported: audioDevicesSupported, labelsAvailable, permissionError, requestPermission } = useSpeechDevices();

  const [mode, setMode] = React.useState<"voice" | "text">("text");
  const [requestingPermission, setRequestingPermission] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Persisted auto-send STT preference (matches key used in ChatInterface)
  const [autoSendStt, setAutoSendStt] = React.useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      const raw = window.localStorage.getItem("sttAutoSend");
      if (raw === null) return true;
      return raw === "true";
    } catch {
      return true;
    }
  });

  // Keep storage in sync when user updates the toggle here
  React.useEffect(() => {
    try {
      localStorage.setItem("sttAutoSend", autoSendStt ? "true" : "false");
    } catch {
      // ignore
    }
  }, [autoSendStt]);

  // When the modal opens, pick a sensible default for the mode based on whether
  // device labels are already available (which implies microphone permission).
  useEffect(() => {
    if (!mounted) return;
    if (audioDevicesSupported && labelsAvailable) {
      setMode("voice");
    } else {
      setMode("text");
    }
    setLocalError(null);
    setRequestingPermission(false);
  }, [mounted, audioDevicesSupported, labelsAvailable]);

  const handleUserClose = () => {
    internalCloseRequestedRef.current = true;
    try {
      onClose();
    } catch (e) {
      // ignore
    }
  };

  const handleContinue = () => {
    internalCloseRequestedRef.current = true;
    try {
      // Pass autoSendStt selection to parent so it can update its state as well
      onContinue?.(mode, { autoSendStt });
    } catch (e) {
      // ignore
    }
    try {
      onClose();
    } catch (e) {
      // ignore
    }
  };

  const handleSelectVoice = async () => {
    if (!audioDevicesSupported) return;
    // If labels already available we can immediately select voice
    if (labelsAvailable) {
      setMode("voice");
      setLocalError(null);
      return;
    }
    setRequestingPermission(true);
    setLocalError(null);
    try {
      await requestPermission();
      // requestPermission updates context (labelsAvailable/permissionError)
      if (permissionError) {
        setLocalError(permissionError);
        setMode("text");
      } else if (labelsAvailable) {
        setMode("voice");
        setLocalError(null);
      } else {
        // fallback: permission didn't yield labels
        setLocalError("Microphone access not granted.");
        setMode("text");
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Permission request failed.");
      setMode("text");
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleSelectText = () => {
    setMode("text");
    setLocalError(null);
  };

  return (
    <>
      {/* Hide the default dialog close button for this modal so Continue is the only closure path */}
      <style>{`[data-hide-close="true"] > button { display: none !important; }`}</style>
      <Dialog
        open={mounted}
        onOpenChange={(open) => {
          // If open becomes false because user clicked Close/Continue, our
          // internal flag will be set and the parent will have already been
          // notified via the button handler. For backdrop/Escape attempts we
          // ignore the close so the modal can only be dismissed via our
          // explicit controls.
          if (open) return;
          if (internalCloseRequestedRef.current) {
            // Clear the flag and allow normal flow (the parent should toggle mounted)
            internalCloseRequestedRef.current = false;
          } else {
            // Ignore backdrop / ESC closes by doing nothing
          }
        }}
      >
        <DialogContent data-hide-close="true" className={`max-w-2xl w-full mx-4 ${className ?? ""}`}>
          <DialogHeader className={`flex flex-row gap-3 ${className ?? ""}`}>
            <div>
              <Image src="/favicon.ico" alt="VEWAI Logo" width={32} height={32} className="rounded-sm" />
            </div>
            <div>
              <DialogTitle className="mb-1">You are about to start the clinical interview</DialogTitle>
              <DialogDescription>
                <span className="text-sm ">Greet the owner, then proceed with history-taking and physical exam questions.</span>
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Mode selector */}
          <div className="">
            <div className="flex items-center gap-3 justify-center mt-2 mb-6">
              <Button
                style={{ minWidth: "120px" }}
                variant={mode === "voice" ? "orange" : "outline"}
                onClick={handleSelectVoice}
                disabled={!audioDevicesSupported || requestingPermission}
              >
                {requestingPermission ? (
                  "Requesting permission..."
                ) : mode === "voice" ? (
                  <CircleDot className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Circle className="w-4 h-4" aria-hidden="true" />
                )}{" "}
                Voice Mode
              </Button>
              <Button style={{ minWidth: "120px" }} variant={mode === "text" ? "orange" : "outline"} onClick={handleSelectText}>
                {mode === "text" ? <CircleDot className="w-4 h-4" aria-hidden="true" /> : <Circle className="w-4 h-4" aria-hidden="true" />}
                Text Mode
              </Button>
            </div>
            <div>
              {mode === "text" && (
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-muted-foreground mb-2">
                  <h3 className="text-orange-500 text-center font-bold mb-1">Text Mode Active</h3>
                  <p className="text-sm">Use the chat window to type messages. Text mode does not use your microphone.</p>
                </div>
              )}
              {mode === "voice" && audioDevicesSupported && (
                <div className="mt-2">
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-muted-foreground mb-2">
                    <h3 className="text-orange-500 text-center font-bold mb-1">Voice Mode Active</h3>
                    <p className="text-sm">Speak your messages using your microphone. Make sure to select the correct input device below:</p>
                  </div>
                  <AudioDeviceSelector />

                  {/* Auto-send STT control */}
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-muted-foreground mt-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm text-orange-500 font-bold mb-1">Auto-send (STT)</h3>
                        <p className="text-sm">
                          When enabled, final speech transcripts will be sent automatically without pressing Send. Disable to review transcripts
                          before sending.
                        </p>
                      </div>
                      <div>
                        <Checkbox
                          checked={autoSendStt}
                          onCheckedChange={(v) => setAutoSendStt(Boolean(v))}
                          className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=checked]:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!audioDevicesSupported && <div className="text-xs text-muted-foreground mt-2">Microphone not supported in this browser.</div>}
              {(localError || permissionError) && <div className="text-xs text-red-600 mt-2">{localError ?? permissionError}</div>}
            </div>
          </div>
          <DialogFooter className={`sm:justify-between sm:items-end ${className ?? ""}`}>
            <span className="text-xs text-muted-foreground">You can toggle voice mode and mic later using the mic button</span>
            <Button
              onClick={handleContinue}
              disabled={mode === "voice" && !labelsAvailable}
              className="dark:text-white"
              style={{ minWidth: "120px" }}
            >
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
