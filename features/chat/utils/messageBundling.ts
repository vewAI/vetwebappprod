import type { Message } from "@/features/chat/models/chat";

export function mergeStringsNoDup(base: string | undefined, add: string | undefined): string {
  const b = String(base || "").trim();
  const a = String(add || "").trim();
  if (!b) return a;
  if (!a) return b;
  const bWords = b.split(/\s+/);
  const aWords = a.split(/\s+/);
  const maxOverlap = Math.min(bWords.length, aWords.length);
  for (let k = maxOverlap; k > 0; k--) {
    const tail = bWords.slice(-k).join(" ").toLowerCase();
    const head = aWords.slice(0, k).join(" ").toLowerCase();
    if (tail === head) {
      return [...bWords.slice(0, bWords.length - k), ...aWords].join(" ");
    }
  }
  return (b + " " + a).trim();
}

export function normalizeForCompare(s: string) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
}

export function shouldCoalesce(lastMsg: Message | undefined, currentPersona: string | null | undefined, newText: string, windowMs = 2500): boolean {
  if (!lastMsg) return false;
  if (lastMsg.role !== "user") return false;
  const lastPersona = lastMsg.personaRoleKey ?? null;
  const curPersona = currentPersona ?? null;
  if (lastPersona !== curPersona) return false;
  const lastTs = lastMsg.timestamp ? Date.parse(lastMsg.timestamp) : NaN;
  if (!Number.isFinite(lastTs)) return false;
  if (Date.now() - lastTs >= windowMs) return false;
  const normLast = normalizeForCompare(lastMsg.content || "");
  const normNew = normalizeForCompare(newText || "");
  if (!normLast || !normNew) return false;
  if (normLast === normNew) return false; // identical -> not coalesce (duplicate suppression elsewhere)
  return true;
}

export function coalesceMessages(messages: Message[], newText: string, currentPersona: string | null | undefined, windowMs = 2500): { messages: Message[]; mergedMessage?: Message | null } {
  const last = messages.length ? messages[messages.length - 1] : undefined;
  if (!shouldCoalesce(last, currentPersona, newText, windowMs)) {
    return { messages, mergedMessage: null };
  }
  const mergedContent = mergeStringsNoDup(last!.content, newText);
  const newTimestamp = new Date().toISOString();
  const mergedMessage: Message = {
    ...last!,
    content: mergedContent,
    timestamp: newTimestamp,
    status: "pending",
  };
  // Ensure persona attribution is preserved or explicitly set to the current persona
  try {
    (mergedMessage as any).personaRoleKey = currentPersona ?? (last as any).personaRoleKey ?? null;
  } catch {}
  const newMessages = [...messages.slice(0, messages.length - 1), mergedMessage];
  return { messages: newMessages, mergedMessage };
}
