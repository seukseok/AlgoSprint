#!/usr/bin/env node

const baseUrl = process.env.WORKER_BASE_URL || "http://localhost:3000";
const intervalMs = Math.max(1000, Number(process.env.WORKER_LOOP_INTERVAL_MS || "1500"));
const token = process.env.WORKER_API_TOKEN || "";

async function tick() {
  const response = await fetch(`${baseUrl}/api/worker`, {
    method: "POST",
    headers: {
      ...(token ? { "x-worker-token": token } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`worker tick failed: ${response.status} ${text}`);
  }
}

async function main() {
  while (true) {
    try {
      await tick();
    } catch (error) {
      console.error(`[worker-loop] ${error instanceof Error ? error.message : "unknown"}`);
      await new Promise((resolve) => setTimeout(resolve, Math.max(3000, intervalMs)));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

void main();
