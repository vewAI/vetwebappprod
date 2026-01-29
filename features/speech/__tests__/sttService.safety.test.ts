import { describe, it, expect, vi } from 'vitest';
import { setSttSuppressed, setSttSuppressedFor, canStartListening, scheduleClearSuppressionWhen, isSttSuppressed, enterDeafMode, exitDeafMode } from '@/features/speech/services/sttService';

describe('sttService safety helpers', () => {
  it('canStartListening respects suppression and deaf mode', () => {
    // Ensure base state
    setSttSuppressed(false, true);
    exitDeafMode();
    expect(canStartListening()).toBe(true);

    setSttSuppressed(true);
    expect(canStartListening()).toBe(false);

    setSttSuppressed(false, true);
    enterDeafMode(2000);
    expect(canStartListening()).toBe(false);

    exitDeafMode();
    expect(canStartListening()).toBe(true);
  });

  it('scheduleClearSuppressionWhen clears suppression when predicate becomes true', async () => {
    setSttSuppressed(true);
    let x = false;
    const handle = scheduleClearSuppressionWhen(() => x === true, 10, 1000);
    expect(isSttSuppressed()).toBe(true);
    // flip predicate after short delay
    await new Promise((r) => setTimeout(r, 50));
    x = true;
    // wait a bit for scheduler to run
    await new Promise((r) => setTimeout(r, 50));
    expect(isSttSuppressed()).toBe(false);
    handle.cancel();
  });
});