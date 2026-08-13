import type { TranscriptEntry } from "../types";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPlainText(entries: TranscriptEntry[]): string {
  return [
    "Live Session Transcript",
    "=======================",
    "",
    ...entries.map((entry) => {
      const speaker = entry.speaker === "user" ? "You" : "Persona";
      return `[${formatTimestamp(entry.timestamp)}] ${speaker}: ${entry.text}`;
    }),
    "",
  ].join("\n");
}

function buildMarkdown(entries: TranscriptEntry[]): string {
  return [
    "# Live Session Transcript",
    "",
    ...entries.map((entry) => {
      const speaker = entry.speaker === "user" ? "You" : "Persona";
      return `- **${speaker}** _${formatTimestamp(entry.timestamp)}_: ${entry.text}`;
    }),
    "",
  ].join("\n");
}

export function exportTranscriptToText(entries: TranscriptEntry[], filename = "live-transcript.txt"): void {
  downloadBlob(buildPlainText(entries), filename, "text/plain;charset=utf-8");
}

export function exportTranscriptToMarkdown(entries: TranscriptEntry[], filename = "live-transcript.md"): void {
  downloadBlob(buildMarkdown(entries), filename, "text/markdown;charset=utf-8");
}

export async function copyTranscriptToClipboard(entries: TranscriptEntry[]): Promise<void> {
  await navigator.clipboard.writeText(buildPlainText(entries));
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
