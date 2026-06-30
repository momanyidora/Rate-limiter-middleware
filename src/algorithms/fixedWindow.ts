import { memoryStore } from "../stores/memoryStore";
import { RateLimitResult } from "../types";

export function fixedWindow(
  callerId: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  let record = memoryStore.get(callerId);

  if (!record) {
    record = {
      count: 0,
      windowStart: now,
    };
  }

  // Reset the counter when the window expires
  if (now - record.windowStart >= windowMs) {
    record.count = 0;
    record.windowStart = now;
  }

  // Count the current request
  record.count++;

  memoryStore.set(callerId, record);

  return {
    allowed: record.count <= limit,
    remaining: Math.max(limit - record.count, 0),
    retryAfter: Math.ceil((windowMs - (now - record.windowStart)) / 1000),
  };
}
