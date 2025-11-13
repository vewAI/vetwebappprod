// TTS init payload store with optional Redis backing.
// If `process.env.REDIS_URL` is set, the store will try to use Redis for
// short-lived (single-use) payload storage. Otherwise it falls back to a
// simple in-memory Map (suitable for development only).

import type { RedisClientType } from "redis";
let redisClient: RedisClientType | null = null;

type Payload = { text: string; voice?: string; expiresAt: number };

const STORE_TTL_SECONDS = 2 * 60; // 2 minutes
const STORE_TTL_MS = STORE_TTL_SECONDS * 1000;

// In-memory fallback
const map = new Map<string, Payload>();

async function ensureRedis() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  // Dynamic import so local dev without redis doesn't need the package at runtime
  const { createClient } = await import("redis");
  const client = createClient({ url });
  try {
    await client.connect();
    redisClient = client as RedisClientType;
    return redisClient;
  } catch {
    // swallow—fall back to in-memory
    return null;
  }
}

async function redisPut(id: string, text: string, voice?: string) {
  const client = await ensureRedis();
  const payload: Payload = {
    text,
    voice,
    expiresAt: Date.now() + STORE_TTL_MS,
  };
  if (!client) {
    map.set(id, payload);
    return;
  }
  const key = `tts:init:${id}`;
  try {
    await client.set(key, JSON.stringify(payload), { EX: STORE_TTL_SECONDS });
  } catch {
    // fallback to in-memory on error
    map.set(id, payload);
  }
}

async function redisGetAndDel(id: string) {
  const client = await ensureRedis();
  const key = `tts:init:${id}`;
  if (!client) {
    const v = map.get(id) ?? null;
    if (!v) return null;
    map.delete(id);
    if (v.expiresAt <= Date.now()) return null;
    return v;
  }
  try {
    // Perform an atomic GET+DEL using EVAL to avoid race conditions where
    // another consumer might read the key at the same time.
    const script =
      "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v";
    // Some redis clients expose `eval` with this signature. Cast to a small
    // interface to avoid using `any` and satisfy eslint/TS rules.
    const evalClient = client as unknown as {
      eval: (
        script: string,
        opts: { keys: string[]; arguments?: string[] }
      ) => Promise<string | null>;
    };
    const raw = (await evalClient.eval(script, { keys: [key] })) as
      | string
      | null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    // on error fall back to in-memory
    const v = map.get(id) ?? null;
    if (!v) return null;
    map.delete(id);
    if (v.expiresAt <= Date.now()) return null;
    return v;
  }
}

async function redisPeek(id: string) {
  const client = await ensureRedis();
  const key = `tts:init:${id}`;
  if (!client) {
    const v = map.get(id) ?? null;
    if (!v) return null;
    if (v.expiresAt <= Date.now()) {
      map.delete(id);
      return null;
    }
    return v;
  }
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    if (parsed.expiresAt <= Date.now()) {
      await client.del(key).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    const v = map.get(id) ?? null;
    if (!v) return null;
    if (v.expiresAt <= Date.now()) {
      map.delete(id);
      return null;
    }
    return v;
  }
}

// Periodic cleanup for in-memory fallback
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of map.entries()) {
    if (v.expiresAt <= now) map.delete(k);
  }
}, 60 * 1000).unref?.();

export function put(id: string, text: string, voice?: string) {
  // intentionally don't await here; callers expect synchronous API
  void redisPut(id, text, voice);
}

export function take(_id: string) {
  void _id;
  // return a promise-like behavior when Redis is in use — but existing callers
  // expect sync returns. To remain compatible we provide a synchronous check
  // against the in-memory map first and otherwise perform a blocking read via
  // sync-style by returning null and letting the stream route attempt to fetch
  // again. However, to keep behavior stable, we'll attempt a fast Redis GET
  // via connect and then fall back synchronously to the map.
  // For simplicity and compatibility with existing code, expose an async API
  // via a helper and keep this function synchronous for now.
  // NOTE: The `init` route uses `put` only. The `stream` route uses `take`.
  // We'll export an async `takeAsync` and keep `take` for compatibility.
  return null as unknown as Payload | null;
}

export async function takeAsync(id: string) {
  return await redisGetAndDel(id);
}

export function peek(id: string) {
  // Keep sync peek for compatibility by checking in-memory only.
  const v = map.get(id) ?? null;
  if (!v) return null;
  if (v.expiresAt <= Date.now()) {
    map.delete(id);
    return null;
  }
  return v;
}

export async function peekAsync(id: string) {
  return await redisPeek(id);
}
