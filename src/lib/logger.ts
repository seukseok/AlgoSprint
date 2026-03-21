type LogLevel = "info" | "warn" | "error";

export function createRequestContext(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  const requestId = incoming && incoming.length > 6 ? incoming : crypto.randomUUID();
  return { requestId, responseHeaders: { "X-Request-Id": requestId } as HeadersInit };
}

export function logEvent(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
