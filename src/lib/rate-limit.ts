import { NextResponse } from "next/server";

type HitBucket = { count: number; resetAt: number };

type LimitResult = {
  limited: boolean;
  retryAfterSec: number;
  headers: HeadersInit;
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

export function checkRateLimit(scope: keyof typeof LIMITS, userId: string, ip: string): LimitResult {
  const now = Date.now();
  const ipResult = consume(`ip:${scope}:${ip}`, LIMITS[scope].perIp.limit, LIMITS[scope].perIp.windowMs, now);
  const userResult = consume(`user:${scope}:${userId}`, LIMITS[scope].perUser.limit, LIMITS[scope].perUser.windowMs, now);

  const limited = ipResult.limited || userResult.limited;
  const retryAfterSec = Math.max(ipResult.retryAfterSec, userResult.retryAfterSec);

  return {
    limited,
    retryAfterSec,
    headers: {
      "Retry-After": `${retryAfterSec}`,
      "X-RateLimit-Scope": scope,
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

function consume(key: string, limit: number, windowMs: number, now: number) {
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
