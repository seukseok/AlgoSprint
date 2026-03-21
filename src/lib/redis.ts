import Redis from "ioredis";
import { logEvent } from "@/lib/logger";

let redisClient: Redis | null | undefined;

export function hasRedis() {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisClient() {
  if (!hasRedis()) return null;
  if (redisClient !== undefined) return redisClient;

  try {
    redisClient = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    redisClient.on("error", (error) => {
      logEvent("warn", "redis.error", { error: error.message });
    });

    void redisClient.connect().catch((error: Error) => {
      logEvent("warn", "redis.connect.failed", { error: error.message });
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    logEvent("warn", "redis.init.failed", { error: error instanceof Error ? error.message : "unknown" });
    redisClient = null;
    return null;
  }
}

export function redisMode() {
  return hasRedis() ? "redis" : "fallback";
}
