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

/**
 * Streamed variant: set an <audio> src to the streaming endpoint so the
 * browser can begin playback as soon as chunks arrive. This uses a GET
 * query-based endpoint for simplicity; note that very long texts may hit
 * URL length limits — if you expect long inputs, consider a POST-to-init
 * pattern or a signed URL approach.
 */
export async function speakRemoteStream(
  text: string,
  voice?: string
): Promise<HTMLAudioElement> {
  if (!text) throw new Error("text required");

  // POST-init flow: request a short streaming URL from the server so we avoid
  // very long GET URLs. The server will return a short url that proxies the
  // upstream provider and supports streaming audio.
  const initResp = await fetch("/api/tts/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!initResp.ok) {
    const body = await initResp.text().catch(() => "");
    throw new Error(`TTS init failed: ${initResp.status} ${body}`);
  }

  const initData = await initResp.json().catch(() => ({} as any));
  const url = String(
    initData?.url ?? initData?.streamUrl ?? `/api/tts/stream?id=${initData?.id}`
  );

  const audio = new Audio(url);

  return await new Promise<HTMLAudioElement>((resolve, reject) => {
    const onEnded = () => {
      cleanup();
      resolve(audio);
    };

    const onError = (ev: any) => {
      cleanup();
      reject(ev ?? new Error("Streamed audio playback error"));
    };

    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch((e) => {
        // Autoplay may be blocked; caller can call audio.play() on user gesture.
        console.warn("Playback blocked by autoplay policy (stream):", e);
      });
    }
  });
}
