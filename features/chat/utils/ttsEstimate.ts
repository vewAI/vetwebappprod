export const estimateTtsDurationMs = (s: string) => {
  try {
    const words = String(s).trim().split(/\s+/).filter(Boolean).length || 1;
    // Average speaking speed in words per minute (conservative)
    const wpm = 155;
    const baseMs = Math.round((words * 60000) / wpm);
    // Add per-punctuation pauses to give more realistic timing
    const punctuationPause = (s.match(/[.,!?]/g) || []).length * 120;
    const commas = (s.match(/[,:;]/g) || []).length * 60;
    const overhead = 300; // network/stream buffer overhead
    const calc = baseMs + punctuationPause + commas + overhead;
    // Bound reasonably
    return Math.min(Math.max(calc, 500), 60_000);
  } catch {
    return 1500;
  }
};
