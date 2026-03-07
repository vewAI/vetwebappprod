import { describe, it, expect } from 'vitest';
import { estimateTtsDurationMs } from '@/features/chat/utils/ttsEstimate';

describe('TTS estimate', () => {
  it('returns at least minimum bound for short text', () => {
    const ms = estimateTtsDurationMs('Hi');
    expect(ms).toBeGreaterThanOrEqual(500);
  });

  it('increases with longer text', () => {
    const shortMs = estimateTtsDurationMs('This is a short sentence.');
    const longMs = estimateTtsDurationMs('This is a much longer test sentence that contains many words and punctuation, intended to increase the estimated duration significantly.');
    expect(longMs).toBeGreaterThan(shortMs);
  });
});