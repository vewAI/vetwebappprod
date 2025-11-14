/**
 * Client helper to call the server TTS route and play the returned audio.
 */
export async function speakRemote(
  text: string,
  voice?: string
): Promise<{ audio: HTMLAudioElement; waitForEnd: Promise<HTMLAudioElement> }> {
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

  let resolveEnd: (a: HTMLAudioElement) => void;
  let rejectEnd: (e: any) => void;
  const waitForEnd = new Promise<HTMLAudioElement>((resolve, reject) => {
    resolveEnd = resolve;
    rejectEnd = reject;
  });

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
    resolveEnd(audio);
  };

  const onError = (e: any) => {
    cleanup();
    try {
      const detail =
        (e && e.message) ||
        (e && e.error && e.error.message) ||
        (e && e.target && e.target.error && e.target.error.message) ||
        String(e);
      rejectEnd(new Error(`Audio playback error: ${detail}`));
    } catch (err) {
      rejectEnd(new Error("Audio playback error"));
    }
  };

  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise.catch((e) => {
      console.warn("Playback blocked by browser autoplay policy:", e);
      // Do not reject here; leave waitForEnd to resolve/reject via
      // the audio element events so callers can still inspect the element.
    });
  }

  return { audio, waitForEnd };
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
): Promise<{ audio: HTMLAudioElement; waitForEnd: Promise<HTMLAudioElement> }> {
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

  // Validate initData to avoid creating an invalid stream URL (which
  // results in opaque media errors that are hard to debug).
  const hasUrl = Boolean(initData?.url || initData?.streamUrl || initData?.id);
  if (!hasUrl) {
    const bodyText = JSON.stringify(initData);
    throw new Error(`TTS init returned no URL or id: ${bodyText}`);
  }

  const url = String(
    initData?.url ?? initData?.streamUrl ?? `/api/tts/stream?id=${initData?.id}`
  );

  const audio = new Audio(url);

  let resolveEnd: (a: HTMLAudioElement) => void;
  let rejectEnd: (e: any) => void;
  const waitForEnd = new Promise<HTMLAudioElement>((resolve, reject) => {
    resolveEnd = resolve;
    rejectEnd = reject;
  });

  const onEnded = () => {
    cleanup();
    resolveEnd(audio);
  };

  const onError = (ev: any) => {
    cleanup();
    try {
      const detail =
        (ev && ev.message) ||
        (ev && ev.error && ev.error.message) ||
        (ev && ev.target && ev.target.error && ev.target.error.message) ||
        String(ev);
      rejectEnd(new Error(`Streamed audio playback error: ${detail}`));
    } catch (err) {
      rejectEnd(new Error("Streamed audio playback error"));
    }
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

  return { audio, waitForEnd };
}
