import { Request } from "express";

export interface FixedWindowRecord {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}
