// Rate limiting with optional Redis backing (authoritative across serverless
// instances) and an in-memory sliding-window fallback for local dev or when
// `REDIS_URL` is not configured.
//
// Redis algorithm: fixed-window INCR + EXPIRE. Slightly burstier at window
// boundaries than the in-memory sliding window, but atomic, cheap, and
// consistent across instances.

import type { RedisClientType } from "redis";

const buckets = new Map<string, number[]>();

let redisClient: RedisClientType | null = null;
let redisLastFailureAt = 0;
const REDIS_RETRY_MS = 30_000;

async function ensureRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (redisClient) return redisClient;
  // Circuit breaker: avoid reconnect storms when Redis is down.
  if (Date.now() - redisLastFailureAt < REDIS_RETRY_MS) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({
      url,
      socket: { connectTimeout: 2_000 },
    });
    // Fail fast: a hanging connect must never stall the request path.
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("redis connect timeout")), 2_500)
      ),
    ]);
    redisClient = client as RedisClientType;
    return redisClient;
  } catch {
    redisLastFailureAt = Date.now();
    return null;
  }
}

/** Race any Redis operation with a short timeout so a wedged connection
 * degrades to the in-memory fallback instead of stalling the request. */
async function withTimeout<T>(op: Promise<T>, ms = 1_500): Promise<T | null> {
  return Promise.race([
    op,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function consumeInMemory(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maxRequests) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export async function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const client = await ensureRedis();
  if (client) {
    const redisKey = `ratelimit:${key}`;
    try {
      const count = await withTimeout(client.incr(redisKey));
      if (count === null) {
        // Timed out: treat as unusable and degrade to in-memory.
        redisLastFailureAt = Date.now();
        redisClient = null;
        return consumeInMemory(key, maxRequests, windowMs);
      }
      if (count === 1) {
        await withTimeout(
          client.expire(redisKey, Math.max(1, Math.ceil(windowMs / 1000)))
        );
      }
      return count <= maxRequests;
    } catch {
      // Redis error → degrade to in-memory rather than blocking the request.
    }
  }
  return consumeInMemory(key, maxRequests, windowMs);
}

// In-memory fallback cleanup.
const cleanup = setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((timestamp) => timestamp > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}, 10 * 60 * 1000);
cleanup.unref?.();
