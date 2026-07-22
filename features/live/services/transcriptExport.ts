import type { Message } from "@/features/chat/models/chat";

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function buildMarkdown(messages: Message[]): string {
  let md = "# Live Session Transcript\n\n";
  let currentStage = -1;

  for (const msg of messages) {
    if (msg.stageIndex !== undefined && msg.stageIndex !== currentStage) {
      currentStage = msg.stageIndex;
      md += `\n## Stage ${currentStage + 1}\n\n`;
    }

    const time = formatTimestamp(msg.timestamp);
    const role =
      msg.role === "user"
        ? "**You**"
        : `**${msg.displayRole || "Persona"}**`;
    md += `[${time}] ${role}: ${msg.content}\n\n`;
  }

  return md;
}

function buildPlainText(messages: Message[]): string {
  let txt = "Live Session Transcript\n";
  txt += "=".repeat(30) + "\n\n";
  let currentStage = -1;

  for (const msg of messages) {
    if (msg.stageIndex !== undefined && msg.stageIndex !== currentStage) {
      currentStage = msg.stageIndex;
      txt += `\n--- Stage ${currentStage + 1} ---\n\n`;
    }

    const time = formatTimestamp(msg.timestamp);
    const role =
      msg.role === "user" ? "You" : msg.displayRole || "Persona";
    txt += `[${time}] ${role}: ${msg.content}\n\n`;
  }

  return txt;
}

export function exportTranscriptToMarkdown(
  messages: Message[],
  filename = "transcript.md"
): void {
  const md = buildMarkdown(messages);
  downloadBlob(md, filename, "text/markdown");
}

export function exportTranscriptToText(
  messages: Message[],
  filename = "transcript.txt"
): void {
  const txt = buildPlainText(messages);
  downloadBlob(txt, filename, "text/plain");
}

export function copyTranscriptToClipboard(messages: Message[]): Promise<void> {
  const txt = buildPlainText(messages);
  return navigator.clipboard.writeText(txt);
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
