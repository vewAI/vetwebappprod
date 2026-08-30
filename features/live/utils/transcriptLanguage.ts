// Detection + server-side repair of transcriptions that the Live model
// produced in a language other than English. The model hears the original
// audio regardless — this only fixes what the student reads.

const NON_LATIN_SCRIPT_RE =
  /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

export function isLikelyNonEnglish(text: string): boolean {
  if (!text || text.length < 2) return false;
  return NON_LATIN_SCRIPT_RE.test(text);
}

export async function translateTranscriptToEnglish(text: string): Promise<string | null> {
  try {
    const { getAccessToken } = await import("@/lib/auth-headers");
    const token = await getAccessToken().catch(() => null);
    const res = await fetch("/api/live/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === "string" && data.text.trim() ? data.text : null;
  } catch {
    return null;
  }
}
