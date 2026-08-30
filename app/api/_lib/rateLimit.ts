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
    const client = createClient({ url });
    await client.connect();
    redisClient = client as RedisClientType;
    return redisClient;
  } catch {
    redisLastFailureAt = Date.now();
    return null;
  }
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
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, Math.max(1, Math.ceil(windowMs / 1000)));
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
