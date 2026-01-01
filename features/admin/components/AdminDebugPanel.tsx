"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/services/authService";
import { debugEventBus, DebugEvent } from "@/lib/debug-events-fixed";
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const LLMProviderManager = dynamic(() => import("./LLMProviderManager"), { ssr: false });

export function AdminDebugPanel() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [llmOpen, setLlmOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const handle = (e: DebugEvent) => setEvents((prev) => [e, ...prev].slice(0, 50));
        debugEventBus.on("debug-event", handle);
        return () => { debugEventBus.off("debug-event", handle); };
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (events.length === 0) return null;

  return (
    <div className="mt-6 border rounded bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Admin Debug Events</h3>
        <div className="flex gap-2 items-center">
          <button
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setEvents([])}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mb-3">
        <button className="text-xs text-muted-foreground hover:underline" onClick={() => setLlmOpen(true)}>Open LLM Provider Manager</button>
        <LLMProviderManager open={llmOpen} onOpenChange={setLlmOpen} />
      </div>
      <div className="space-y-2 max-h-56 overflow-auto">
        {events.map((ev) => (
          <div
            key={ev.id}
            className={cn(
              "p-2 rounded border",
              ev.type === "info" && "bg-blue-50 border-blue-200",
              ev.type === "success" && "bg-green-50 border-green-200",
              ev.type === "warning" && "bg-yellow-50 border-yellow-200",
              ev.type === "error" && "bg-red-50 border-red-200"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {ev.type === "info" && <Info className="w-4 h-4" />}
                {ev.type === "warning" && <AlertTriangle className="w-4 h-4" />}
                {ev.type === "error" && <AlertCircle className="w-4 h-4" />}
                {ev.type === "success" && <CheckCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono opacity-80">{ev.source} · {new Date(ev.timestamp).toLocaleTimeString()}</div>
                <div className="text-sm">{ev.message}</div>
                {ev.details && (
                  <pre className="text-[10px] bg-black/5 p-2 rounded mt-2 overflow-auto">{JSON.stringify(ev.details, null, 2)}</pre>
                )}
              </div>
              <button onClick={() => setEvents((p) => p.filter(x => x.id !== ev.id))} className="opacity-60 hover:opacity-100 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
