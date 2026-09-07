"use client";

import { useEffect } from "react";

type ClientLogEntry = {
  level: "error" | "warn";
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  at: string;
};

const MAX_ENTRIES_PER_WINDOW = 20;
const WINDOW_MS = 60_000;
let sentTimestamps: number[] = [];
let queue: ClientLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function underRateLimit(): boolean {
  const now = Date.now();
  if (!sentTimestamps) sentTimestamps = [];
  sentTimestamps = sentTimestamps.filter((t) => now - t < WINDOW_MS);
  if (sentTimestamps.length >= MAX_ENTRIES_PER_WINDOW) return false;
  sentTimestamps.push(now);
  return true;
}

function queueAndFlush(entry: ClientLogEntry) {
  if (!underRateLimit()) return;
  queue.push(entry);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    try {
      navigator.sendBeacon?.(
        "/api/client-logs",
        new Blob([JSON.stringify({ entries: batch })], { type: "application/json" })
      );
    } catch {
      // never let the logger break the app
    }
  }, 1000);
}

function report(level: "error" | "warn", message: string, stack?: string) {
  try {
    queueAndFlush({
      level,
      message: String(message ?? "").slice(0, 500),
      stack: stack ? String(stack).slice(0, 2000) : undefined,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

// Global client error reporter: uncaught errors and promise rejections are
// batched and POSTed to /api/client-logs, where they land in the server logs
// (visible in Vercel) for debugging production issues.
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report("error", event.message, event.error?.stack ?? undefined);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(
        "error",
        `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
        reason instanceof Error ? reason.stack : undefined
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
