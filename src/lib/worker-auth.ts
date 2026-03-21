import crypto from "node:crypto";
import { getRedisClient } from "@/lib/redis";
import { ERROR_CODES } from "@/lib/error-codes";

const TOLERANCE_MS = Math.max(10_000, Number(process.env.WORKER_AUTH_TOLERANCE_MS ?? "300000"));
const NONCE_PREFIX = "worker:nonce:";
const inMemoryNonces = new Map<string, number>();

function cleanupNonces(now: number) {
  for (const [key, expires] of inMemoryNonces.entries()) {
    if (expires <= now) inMemoryNonces.delete(key);
  }
}

export function signWorkerPayload({ token, timestamp, body }: { token: string; timestamp: number; body: string }) {
  return crypto.createHmac("sha256", token).update(`${timestamp}.${body}`).digest("hex");
}

async function markNonceOnce(signature: string, now: number) {
  const ttl = Math.max(30_000, TOLERANCE_MS * 2);
  const redis = getRedisClient();
  if (redis) {
    const ok = await redis.set(`${NONCE_PREFIX}${signature}`, String(now), "PX", ttl, "NX");
    return ok === "OK";
  }

  cleanupNonces(now);
  if (inMemoryNonces.has(signature)) return false;
  inMemoryNonces.set(signature, now + ttl);
  return true;
}

export async function verifyWorkerRequest(request: Request) {
  const token = process.env.WORKER_API_TOKEN?.trim();
  if (!token) return { ok: true as const };

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const rawToken = request.headers.get("x-worker-token") ?? bearer;
  if (!rawToken || rawToken !== token) {
    return { ok: false as const, status: 401, code: ERROR_CODES.WORKER_UNAUTHORIZED, message: "Unauthorized" };
  }

  const ts = Number(request.headers.get("x-worker-ts") ?? "0");
  const signature = request.headers.get("x-worker-signature") ?? "";
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false as const, status: 401, code: ERROR_CODES.WORKER_TIMESTAMP_INVALID, message: "Missing timestamp" };
  }
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { ok: false as const, status: 401, code: ERROR_CODES.WORKER_UNAUTHORIZED, message: "Missing signature" };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > TOLERANCE_MS) {
    return { ok: false as const, status: 401, code: ERROR_CODES.WORKER_TIMESTAMP_INVALID, message: "Timestamp out of tolerance" };
  }

  const body = await request.text();
  const expected = signWorkerPayload({ token, timestamp: ts, body });
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()))) {
    return { ok: false as const, status: 401, code: ERROR_CODES.WORKER_UNAUTHORIZED, message: "Invalid signature" };
  }

  const fresh = await markNonceOnce(signature.toLowerCase(), now);
  if (!fresh) {
    return { ok: false as const, status: 409, code: ERROR_CODES.WORKER_REPLAY_REJECTED, message: "Replay detected" };
  }

  return { ok: true as const, body };
}
