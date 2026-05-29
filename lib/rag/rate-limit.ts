import { getRateLimitPerMinute } from "@/lib/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string) {
  const now = Date.now();
  const limit = getRateLimitPerMinute();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + 60_000
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count) };
}
