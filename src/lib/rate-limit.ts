import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

type HitBucket = { count: number; resetAt: number };

type LimitResult = {
  limited: boolean;
  retryAfterSec: number;
  headers: HeadersInit;
  backend: "memory" | "redis";
};

const store = new Map<string, HitBucket>();

const LIMITS = {
  execute: { perIp: { limit: 30, windowMs: 60_000 }, perUser: { limit: 20, windowMs: 60_000 } },
  submit: { perIp: { limit: 12, windowMs: 60_000 }, perUser: { limit: 8, windowMs: 60_000 } },
} as const;

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(scope: keyof typeof LIMITS, userId: string, ip: string): Promise<LimitResult> {
  const redis = getRedisClient();
  const now = Date.now();

  if (redis) {
    try {
      const ipResult = await consumeRedis(redis, `ip:${scope}:${ip}`, LIMITS[scope].perIp.limit, LIMITS[scope].perIp.windowMs, now);
      const userResult = await consumeRedis(redis, `user:${scope}:${userId}`, LIMITS[scope].perUser.limit, LIMITS[scope].perUser.windowMs, now);
      const limited = ipResult.limited || userResult.limited;
      const retryAfterSec = Math.max(ipResult.retryAfterSec, userResult.retryAfterSec);
      return {
        limited,
        retryAfterSec,
        backend: "redis",
        headers: {
          "Retry-After": `${retryAfterSec}`,
          "X-RateLimit-Scope": scope,
          "X-RateLimit-Backend": "redis",
        },
      };
    } catch {
      // fall back to memory when redis is unavailable temporarily
    }
  }

  const ipResult = consumeMemory(`ip:${scope}:${ip}`, LIMITS[scope].perIp.limit, LIMITS[scope].perIp.windowMs, now);
  const userResult = consumeMemory(`user:${scope}:${userId}`, LIMITS[scope].perUser.limit, LIMITS[scope].perUser.windowMs, now);
  const limited = ipResult.limited || userResult.limited;
  const retryAfterSec = Math.max(ipResult.retryAfterSec, userResult.retryAfterSec);

  return {
    limited,
    retryAfterSec,
    backend: "memory",
    headers: {
      "Retry-After": `${retryAfterSec}`,
      "X-RateLimit-Scope": scope,
      "X-RateLimit-Backend": "memory",
    },
  };
}

export function rateLimitErrorResponse(scope: "execute" | "submit", retryAfterSec: number, headers: HeadersInit) {
  const message =
    scope === "submit"
      ? "제출 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
      : "실행 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

  return NextResponse.json(
    {
      error: message,
      retryAfterSec,
    },
    {
      status: 429,
      headers,
    },
  );
}

function consumeMemory(key: string, limit: number, windowMs: number, now: number) {
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  existing.count += 1;
  store.set(key, existing);

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    limited: existing.count > limit,
    retryAfterSec,
  };
}

async function consumeRedis(redis: NonNullable<ReturnType<typeof getRedisClient>>, key: string, limit: number, windowMs: number, now: number) {
  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey = `ratelimit:${key}`;
  const current = await redis.incr(redisKey);
  if (current === 1) {
    await redis.expire(redisKey, windowSec);
  }

  const ttl = await redis.ttl(redisKey);
  const retryAfterSec = Math.max(1, ttl > 0 ? ttl : Math.ceil((windowMs - (now % windowMs)) / 1000));
  return {
    limited: current > limit,
    retryAfterSec,
  };
}
