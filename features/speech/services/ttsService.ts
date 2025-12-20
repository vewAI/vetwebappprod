import type { TtsEventDetail } from "@/features/speech/models/tts-events";
import {
  dispatchTtsEnd,
  dispatchTtsStart,
} from "@/features/speech/models/tts-events";
import {
  buildAuthHeaders,
  getAccessToken,
} from "@/lib/auth-headers";
import { getPreferredOutputDevice } from "./deviceRegistry";
import { debugEventBus } from "@/lib/debug-events-fixed";

type TtsMeta = Omit<TtsEventDetail, "audio"> | undefined;

type ActivePlaybackHandle = {
  audio: HTMLAudioElement;
  stop: () => void;
};

let activePlayback: ActivePlaybackHandle | null = null;

function registerActivePlayback(handle: ActivePlaybackHandle) {
  if (activePlayback && activePlayback.audio !== handle.audio) {
    try {
      activePlayback.stop();
    } catch (error) {
      console.warn("Failed to stop previous TTS playback", error);
    }
  }
  activePlayback = handle;
}

function clearActivePlayback(audio: HTMLAudioElement) {
  if (activePlayback && activePlayback.audio === audio) {
    activePlayback = null;
  }
}

async function applyPreferredOutputDevice(audio: HTMLAudioElement) {
  const sinkAware = audio as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };
  const sinkId = getPreferredOutputDevice();
  if (!sinkId) return;
  if (typeof sinkAware.setSinkId !== "function") return;
  try {
    await sinkAware.setSinkId(sinkId);
  } catch (err) {
    console.warn("Failed to route audio to selected output device", err);
  }
}

export function stopActiveTtsPlayback() {
  if (!activePlayback) return;
  const handle = activePlayback;
  activePlayback = null;
  try {
    handle.stop();
  } catch (error) {
    console.warn("Failed to stop active TTS playback", error);
  }
}
/**
 * Client helper to call the server TTS route and play the returned audio.
 */
export async function speakRemote(
  text: string,
  voice?: string,
  meta?: TtsMeta
): Promise<HTMLAudioElement> {
  if (!text) throw new Error("text required");

  const startTime = Date.now();
  debugEventBus.emitEvent('info', 'TTS', 'Requesting speech synthesis', { textLength: text.length, voice });

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: await buildAuthHeaders(
      { "Content-Type": "application/json" },
      token
    ),
    body: JSON.stringify({ text, voice }),
  });

  if (!res.ok) {
    // Try to parse structured fallback instruction from the server
    let bodyJson: any = null;
    try {
      bodyJson = await res.json();
    } catch (_) {
      bodyJson = null;
    }

    if (bodyJson && bodyJson.fallback === "browser") {
      debugEventBus.emitEvent('warning', 'TTS', 'Server TTS unavailable, using browser voices', { voice, detail: bodyJson.detail });
      // Use browser SpeechSynthesis as a fallback. Respect avatar sex if provided in meta.
      await speakWithSpeechSynthesis(text, voice, meta);
      // Return a real Audio element placeholder so callers get an HTMLAudioElement.
      const placeholder = new Audio();
      return placeholder;
    }

    const body = await res.text().catch(() => "");
    debugEventBus.emitEvent('error', 'TTS', `Remote TTS failed: ${res.status}`, { body });
    throw new Error(`Remote TTS failed: ${res.status} ${body}`);
  }

  const buf = await res.arrayBuffer();
  debugEventBus.emitEvent('success', 'TTS', `Audio received in ${Date.now() - startTime}ms`, { size: buf.byteLength });
  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const blob = new Blob([buf], { type: contentType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  // Preload metadata to reduce startup latency
  audio.preload = "auto";
  await applyPreferredOutputDevice(audio);

  // Return a promise that resolves when playback ends (or rejects on error)
  return new Promise<HTMLAudioElement>((resolve, reject) => {
    const endLifecycle = trackTtsLifecycle(audio, meta);

    function cleanup() {
      clearActivePlayback(audio);
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {
        /* ignore */
      }
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      endLifecycle();
    }

    function onEnded() {
      cleanup();
      resolve(audio);
    }

    function onError(e: any) {
      cleanup();
      // Normalize media errors/events into Error with useful detail
      try {
        const detail =
          (e && e.message) ||
          (e && e.error && e.error.message) ||
          (e && e.target && e.target.error && e.target.error.message) ||
          String(e);
        reject(new Error(`Audio playback error: ${detail}`));
      } catch (err) {
        reject(new Error("Audio playback error"));
      }
    }

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError as EventListener);

    registerActivePlayback({
      audio,
      stop: () => {
        cleanup();
        resolve(audio);
      },
    });

    // Try to start playback. If autoplay is blocked, the caller may need to
    // trigger play via a user gesture — handle that by warning and allow the
    // caller to attempt playback later via the returned Audio element.
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch((e) => {
        console.warn("Playback blocked by browser autoplay policy:", e);
        // Do not reject here; leave the promise to resolve/reject via
        // the audio element events so callers can still inspect the element.
      });
    }
  });
}

async function speakWithSpeechSynthesis(text: string, voice?: string, meta?: TtsMeta) {
  const preferredSex = (meta && meta.metadata && (meta.metadata.sex as string)) || undefined;
  const suggestGenderFromVoice = (v?: string) => {
    const female = ["alice", "charlotte", "lily", "matilda"];
    const male = ["charlie", "george", "harry"];
    if (!v) return "neutral";
    if (female.includes(v)) return "female";
    if (male.includes(v)) return "male";
    return "neutral";
  };

  const desiredGender = preferredSex ?? suggestGenderFromVoice(voice);

  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !('speechSynthesis' in window)) {
      console.warn('Browser speechSynthesis not available');
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (!voices || voices.length === 0) {
      // Some browsers load voices asynchronously
      synth.onvoiceschanged = () => {
        voices = synth.getVoices() || [];
      };
    }

    const pickVoice = () => {
      voices = synth.getVoices() || [];
      // Prefer en-US voices matching desired gender in the name when possible
      const genderPriority = desiredGender === 'female' ? ['female','woman','f'] : desiredGender === 'male' ? ['male','man','m'] : [];
      const byLang = voices.filter(v => v.lang && v.lang.startsWith('en'));
      let candidate: SpeechSynthesisVoice | undefined;
      if (genderPriority.length) {
        candidate = byLang.find(v => genderPriority.some(g => String(v.name).toLowerCase().includes(g)));
      }
      if (!candidate) candidate = byLang[0] || voices[0];
      return candidate;
    };

    const utter = new SpeechSynthesisUtterance(text);
    const chosen = pickVoice();
    if (chosen) utter.voice = chosen;
    utter.rate = 1;
    utter.pitch = 1;

    dispatchTtsStart({ ...(meta ?? {}), audio: undefined as unknown as HTMLAudioElement });

    utter.onend = () => {
      dispatchTtsEnd({ ...(meta ?? {}), audio: undefined as unknown as HTMLAudioElement });
      resolve();
    };
    utter.onerror = () => {
      dispatchTtsEnd({ ...(meta ?? {}), audio: undefined as unknown as HTMLAudioElement });
      resolve();
    };

    synth.speak(utter);
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
  voice?: string,
  meta?: TtsMeta
): Promise<HTMLAudioElement> {
  if (!text) throw new Error("text required");

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  // POST-init flow: request a short streaming URL from the server so we avoid
  // very long GET URLs. The server will return a short url that proxies the
  // upstream provider and supports streaming audio.
  const initResp = await fetch("/api/tts/init", {
    method: "POST",
    headers: await buildAuthHeaders(
      { "Content-Type": "application/json" },
      token
    ),
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
  // Preload metadata to reduce startup latency
  audio.preload = "auto";
  await applyPreferredOutputDevice(audio);

  return await new Promise<HTMLAudioElement>((resolve, reject) => {
    const endLifecycle = trackTtsLifecycle(audio, meta);

    function cleanup() {
      clearActivePlayback(audio);
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {
        /* ignore */
      }
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      endLifecycle();
    }

    function onEnded() {
      cleanup();
      resolve(audio);
    }

    function onError(ev: any) {
      cleanup();
      void attemptBufferedFallback(ev);
    }

    async function attemptBufferedFallback(ev: any) {
      try {
        console.warn(
          "Streamed audio failed, attempting buffered fallback:",
          ev
        );
        const resp = await fetch(url, {
          cache: "no-store",
          headers: await buildAuthHeaders({}, token),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Fallback fetch failed: ${resp.status} ${txt}`);
        }
        const buf = await resp.arrayBuffer();
        const contentType = resp.headers.get("content-type") ?? "audio/mpeg";
        const blob = new Blob([buf], { type: contentType });
        const objUrl = URL.createObjectURL(blob);

        const fallbackAudio = new Audio(objUrl);
        await applyPreferredOutputDevice(fallbackAudio);
        const fallbackMeta = meta
          ? {
              ...meta,
              metadata: {
                ...(meta.metadata ?? {}),
                playbackVariant: "buffered-fallback",
              },
            }
          : { metadata: { playbackVariant: "buffered-fallback" } };
        const endFallbackLifecycle = trackTtsLifecycle(
          fallbackAudio,
          fallbackMeta
        );

        function cleanupFallback() {
          clearActivePlayback(fallbackAudio);
          try {
            fallbackAudio.pause();
            fallbackAudio.currentTime = 0;
          } catch (e) {
            /* ignore */
          }
          fallbackAudio.removeEventListener("ended", onFallbackEnd);
          fallbackAudio.removeEventListener("error", onFallbackError);
          endFallbackLifecycle();
          try {
            URL.revokeObjectURL(objUrl);
          } catch (e) {
            /* ignore */
          }
        }

        function onFallbackEnd() {
          cleanupFallback();
          resolve(fallbackAudio);
        }

        function onFallbackError(e: any) {
          cleanupFallback();
          const detail =
            (e && e.message) ||
            (e && e.error && e.error.message) ||
            (e && e.target && e.target.error && e.target.error.message) ||
            String(e);
          reject(new Error(`Streamed audio fallback failed: ${detail}`));
        }

        fallbackAudio.addEventListener("ended", onFallbackEnd);
        fallbackAudio.addEventListener(
          "error",
          onFallbackError as EventListener
        );
        registerActivePlayback({
          audio: fallbackAudio,
          stop: () => {
            cleanupFallback();
            resolve(fallbackAudio);
          },
        });
        const p = fallbackAudio.play();
        if (p && typeof p.then === "function") {
          p.catch((playErr) => {
            console.warn(
              "Fallback playback blocked by autoplay policy:",
              playErr
            );
          });
        }
      } catch (fallbackErr: unknown) {
        try {
          const fallbackMessage =
            typeof fallbackErr === "object" && fallbackErr !== null && "message" in fallbackErr
              ? String((fallbackErr as { message?: string }).message ?? fallbackErr)
              : String(fallbackErr);
          const eventMessage =
            typeof ev === "object" && ev !== null && "message" in ev
              ? String((ev as { message?: string }).message ?? ev)
              : String(ev);
          const detail = fallbackMessage || eventMessage;
          reject(new Error(`Streamed audio playback error: ${detail}`));
        } catch (err) {
          reject(new Error("Streamed audio playback error"));
        }
      }
    }

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError as EventListener);

    registerActivePlayback({
      audio,
      stop: () => {
        cleanup();
        resolve(audio);
      },
    });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch((e) => {
        // Autoplay may be blocked; caller can call audio.play() on user gesture.
        console.warn("Playback blocked by autoplay policy (stream):", e);
      });
    }
  });
}

function trackTtsLifecycle(
  audio: HTMLAudioElement,
  meta?: TtsMeta
): () => void {
  const detail: TtsEventDetail = { ...(meta ?? {}), audio };
  let finished = false;
  dispatchTtsStart(detail);
  return () => {
    if (finished) return;
    finished = true;
    dispatchTtsEnd(detail);
  };
}
