import { scheduleClearSuppressionWhen } from "../utils/timers";
import * as sttService from "../../speech/services/sttService";

type SuppressionEntry = {
  reason: string;
  expiresAt: number;
  timerId: number | null;
};

const suppressions: Map<string, SuppressionEntry> = new Map();

function computeMaxRemainingMs(now = Date.now()) {
  let max = 0;
  for (const v of suppressions.values()) {
    max = Math.max(max, Math.max(0, v.expiresAt - now));
  }
  return max;
}

export function addSuppression(reason: string, durationMs: number) {
  try {
    const now = Date.now();
    const expiresAt = now + Math.max(0, Math.floor(durationMs));
    const existing = suppressions.get(reason);
    if (existing) {
      // Clear prior timer
      try {
        if (existing.timerId) window.clearTimeout(existing.timerId);
      } catch {}
    }
    const entry: SuppressionEntry = { reason, expiresAt, timerId: null };
    // Schedule removal
    const remaining = Math.max(0, expiresAt - now);
    entry.timerId = window.setTimeout(() => {
      try {
        suppressions.delete(reason);
        const maxRemaining = computeMaxRemainingMs();
        if (maxRemaining > 0) {
          // refresh service-level suppression
          try {
            sttService.setSttSuppressedFor(maxRemaining, "speechService-multi");
          } catch {}
        } else {
          // clear suppression immediately (skip cooldown)
          try {
            sttService.setSttSuppressed(false, true, "speechService-clear");
          } catch {}
        }
      } catch (e) {
        // ignore
      }
    }, remaining) as unknown as number;

    suppressions.set(reason, entry);

    // Update global suppression to the longest remaining
    const maxRemaining = computeMaxRemainingMs(now);
    try {
      sttService.setSttSuppressedFor(maxRemaining, "speechService-multi");
    } catch {}
    return {
      cancel: () => {
        try {
          const e = suppressions.get(reason);
          if (e && e.timerId) window.clearTimeout(e.timerId);
        } catch {}
        suppressions.delete(reason);
        const maxRemaining2 = computeMaxRemainingMs();
        try {
          if (maxRemaining2 > 0)
            sttService.setSttSuppressedFor(
              maxRemaining2,
              "speechService-multi",
            );
          else sttService.setSttSuppressed(false, true, "speechService-clear");
        } catch {}
      },
    };
  } catch (e) {
    return { cancel: () => {} };
  }
}

export function clearAllSuppressions() {
  for (const [, v] of suppressions) {
    try {
      if (v.timerId) window.clearTimeout(v.timerId);
    } catch {}
  }
  suppressions.clear();
  try {
    sttService.setSttSuppressed(false, true, "speechService-clearAll");
  } catch {}
}

export function scheduleClearSuppression(
  predicate: () => boolean,
  timeoutMs = 5000,
) {
  return scheduleClearSuppressionWhen(predicate, timeoutMs);
}

export function canStartListening() {
  try {
    return sttService.canStartListening();
  } catch {
    return false;
  }
}

import { debugEventBus } from "../../../lib/debug-events-fixed";

export function requestStart(caller?: string) {
  try {
    // Expose a single check entry so callers don't directly bypass suppression
    const ok = canStartListening();
    try {
      (debugEventBus as any)?.emitEvent?.(
        "info",
        "speechService",
        "requestStart",
        {
          caller: caller ?? null,
          allowed: ok,
          ts: Date.now(),
        },
      );
    } catch {}
    return ok;
  } catch {
    return false;
  }
}

export default {
  addSuppression,
  clearAllSuppressions,
  scheduleClearSuppression,
  canStartListening,
  requestStart,
};
