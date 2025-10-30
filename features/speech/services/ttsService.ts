/**
 * Client helper to call the server TTS route and play the returned audio.
 */
export async function speakRemote(
  text: string,
  voice?: string
): Promise<HTMLAudioElement> {
  if (!text) throw new Error("text required");

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Remote TTS failed: ${res.status} ${body}`);
  }

  const buf = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const blob = new Blob([buf], { type: contentType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  // Return a promise that resolves when playback ends (or rejects on error)
  return new Promise<HTMLAudioElement>((resolve, reject) => {
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    const onEnded = () => {
      cleanup();
      resolve(audio);
    };

    const onError = (e: any) => {
      cleanup();
      reject(e ?? new Error("Audio playback error"));
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // Try to start playback. If autoplay is blocked, the caller may need to
    // trigger play via a user gesture — handle that by resolving when play
    // successfully starts and then waiting for ended.
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch((e) => {
        // Autoplay prevented. Let the caller handle a subsequent user gesture.
        console.warn("Playback blocked by browser autoplay policy:", e);
        // Still resolve with audio so caller can call audio.play() later.
        // We do not resolve here; instead leave the promise to be resolved
        // when the audio actually ends (onEnded) or reject on error.
      });
    }
  });
}
