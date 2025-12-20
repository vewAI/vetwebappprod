"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/services/authService";
import { debugEventBus, DebugEvent } from "@/lib/debug-events-fixed";
import { X, AlertTriangle, Info, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminDebugOverlay() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const handleEvent = (event: DebugEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events
      
      // Auto-remove success/info toasts after 5 seconds
      if (event.type === 'info' || event.type === 'success') {
        setTimeout(() => {
          setEvents((current) => current.filter(e => e.id !== event.id));
        }, 5000);
      }
    };

    debugEventBus.on("debug-event", handleEvent);

    return () => {
      debugEventBus.off("debug-event", handleEvent);
    };
  }, [isAdmin]);

  // Listen for debug toggle changes from admin panel
  useEffect(() => {
    const handleDebugToggle = (e: CustomEvent) => {
      setIsVisible(Boolean(e.detail));
    };
    window.addEventListener("debugOverlayToggle", handleDebugToggle as EventListener);
    // On mount, sync with localStorage
    setIsVisible(window.localStorage.getItem("debugOverlay") === "true");
    return () => {
      window.removeEventListener("debugOverlayToggle", handleDebugToggle as EventListener);
    };
  }, []);

  if (!isAdmin || !isVisible) return null;

  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      <div className="flex justify-end mb-2 pointer-events-auto">
        <button 
          onClick={() => setEvents([])}
          className="text-xs bg-black/50 text-white px-2 py-1 rounded hover:bg-black/70 transition-colors"
        >
          Clear All
        </button>
      </div>
      {events.map((event) => (
        <div
          key={event.id}
          className={cn(
            "pointer-events-auto p-3 rounded-lg shadow-lg border backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-right-full",
            event.type === "info" && "bg-blue-950/80 border-blue-800 text-blue-100",
            event.type === "warning" && "bg-yellow-950/80 border-yellow-800 text-yellow-100",
            event.type === "error" && "bg-red-950/80 border-red-800 text-red-100",
            event.type === "success" && "bg-green-950/80 border-green-800 text-green-100"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {event.type === "info" && <Info className="w-4 h-4" />}
              {event.type === "warning" && <AlertTriangle className="w-4 h-4" />}
              {event.type === "error" && <AlertCircle className="w-4 h-4" />}
              {event.type === "success" && <CheckCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono opacity-70 uppercase tracking-wider">
                  {event.source}
                </span>
                <span className="text-[10px] opacity-50">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm font-medium leading-tight mt-1">
                {event.message}
              </p>
              {event.details && (
                <pre className="mt-2 text-[10px] bg-black/30 p-2 rounded overflow-x-auto">
                  {JSON.stringify(event.details, null, 2)}
                </pre>
              )}
            </div>
            <button
              onClick={() => setEvents((prev) => prev.filter((e) => e.id !== event.id))}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
