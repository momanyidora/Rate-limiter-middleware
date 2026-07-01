import {Request} from "express"
export interface FixedWindowRecord{
    count: number;
    windowStart: number;
}


export interface TokenBucketRecord {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiterOptions{
    algorithm?: Algorithm;
    limit?: number;
    windowMs?: number;

    capacity?: number;
    refillRate?: number;

    keyGenerator?: (req: Request) => string;
}

export interface RateLimitResult{
    allowed: boolean;
    remaining: number;
    retryAfter: number;
}

export type Algorithm = "fixed-window" 
| "token-bucket"
