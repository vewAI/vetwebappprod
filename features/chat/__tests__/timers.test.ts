import { describe, it, expect, vi, afterEach } from "vitest";
import { scheduleClearSuppressionWhen } from "../utils/timers";

describe("scheduleClearSuppressionWhen", () => {
  afterEach(() => {
    try {
      vi.useRealTimers();
    } catch {}
  });

  it("resolves true if predicate becomes true before timeout", async () => {
    vi.useFakeTimers();
    let flag = false;
    const handle = scheduleClearSuppressionWhen(() => flag, 1000);
    // flip predicate after 200ms
    setTimeout(() => {
      flag = true;
    }, 200);
    vi.advanceTimersByTime(200);
    // allow pending promise microtasks to run under fake timers
    await Promise.resolve();
    const res = await handle.promise;
    expect(res).toBe(true);
  });

  it("resolves false on timeout", async () => {
    vi.useFakeTimers();
    let flag = false;
    const handle = scheduleClearSuppressionWhen(() => flag, 1000);
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    const res = await handle.promise;
    expect(res).toBe(false);
  });

  it("cancels correctly", async () => {
    vi.useFakeTimers();
    let flag = false;
    const handle = scheduleClearSuppressionWhen(() => flag, 1000);
    handle.cancel();
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    const res = await handle.promise;
    expect(res).toBe(false);
  });
});
