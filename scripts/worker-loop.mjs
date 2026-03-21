#!/usr/bin/env node

import crypto from "node:crypto";

const baseUrl = process.env.WORKER_BASE_URL || "http://localhost:3000";
const intervalMs = Math.max(1000, Number(process.env.WORKER_LOOP_INTERVAL_MS || "1500"));
const token = process.env.WORKER_API_TOKEN || "";

function buildAuthHeaders(body = "") {
  if (!token) return {};
  const timestamp = Date.now();
  const signature = crypto.createHmac("sha256", token).update(`${timestamp}.${body}`).digest("hex");
  return {
    "x-worker-token": token,
    "x-worker-ts": String(timestamp),
    "x-worker-signature": signature,
  };
}

async function tick() {
  const body = "";
  const response = await fetch(`${baseUrl}/api/worker`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(body),
    },
    body,
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
