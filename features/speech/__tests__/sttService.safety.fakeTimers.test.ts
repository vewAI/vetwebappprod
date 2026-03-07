import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setSttSuppressed, isSttSuppressed, scheduleClearSuppressionWhen } from '@/features/speech/services/sttService';

describe('scheduleClearSuppressionWhen (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure base state
    setSttSuppressed(false, true);
  });

  afterEach(() => {
    try {
      vi.runOnlyPendingTimers();
    } catch (e) {}
    vi.useRealTimers();
  });

  it('clears suppression when predicate becomes true', () => {
    setSttSuppressed(true);
    let flag = false;
    const handle = scheduleClearSuppressionWhen(() => flag === true, 100, 2000);

    // still suppressed before predicate flips
    expect(isSttSuppressed()).toBe(true);

    // Advance time to let the check run a few times
    vi.advanceTimersByTime(300);
    expect(isSttSuppressed()).toBe(true);

    // Flip predicate and advance
    flag = true;
    vi.advanceTimersByTime(200);

    expect(isSttSuppressed()).toBe(false);

    // Cancel handle should be safe even after cleared
    handle.cancel();
  });

  it('does not clear suppression on timeout', () => {
    setSttSuppressed(true);
    // predicate never becomes true
    const handle = scheduleClearSuppressionWhen(() => false, 100, 1000);

    // Fast-forward past timeout
    vi.advanceTimersByTime(1200);

    // Suppression should still be active (timeout does not auto-clear)
    expect(isSttSuppressed()).toBe(true);

    handle.cancel();
  });

  it('cancel prevents any clearing even if predicate becomes true later', () => {
    setSttSuppressed(true);
    let flag = false;
    const handle = scheduleClearSuppressionWhen(() => flag === true, 100, 2000);

    // Cancel immediately
    handle.cancel();
    vi.advanceTimersByTime(500);

    // Still suppressed
    expect(isSttSuppressed()).toBe(true);

    // Flip predicate and advance - should still not clear because cancelled
    flag = true;
    vi.advanceTimersByTime(500);

    expect(isSttSuppressed()).toBe(true);
  });
});