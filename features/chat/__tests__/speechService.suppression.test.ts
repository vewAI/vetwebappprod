import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../speech/services/sttService", () => ({
  setSttSuppressedFor: vi.fn(),
  setSttSuppressed: vi.fn(),
  canStartListening: vi.fn(() => true),
}));

import * as speechService from "../services/speechService";
import * as sttService from "../../speech/services/sttService";

describe("speechService suppression registry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (sttService.setSttSuppressedFor as any).mockClear();
    (sttService.setSttSuppressed as any).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    speechService.clearAllSuppressions();
  });

  it("keeps suppression until all reasons expire and calls clear once", () => {
    const cancelA = speechService.addSuppression("a", 1000);
    const cancelB = speechService.addSuppression("b", 3000);

    // After adding, the longest duration should be applied
    expect(sttService.setSttSuppressedFor as any).toHaveBeenCalled();
    // Advance to 1s -> 'a' expires but 'b' remains
    vi.advanceTimersByTime(1000);
    // should not have cleared suppression yet
    expect(sttService.setSttSuppressed as any).not.toHaveBeenCalled();

    // Advance to 3s -> 'b' expires, suppression should be cleared
    vi.advanceTimersByTime(2000);
    expect(sttService.setSttSuppressed as any).toHaveBeenCalledWith(
      false,
      true,
      expect.any(String),
    );

    // Clean up
    cancelA.cancel();
    cancelB.cancel();
  });
});
