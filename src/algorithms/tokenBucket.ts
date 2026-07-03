
import { tokenBucketStore } from "../stores/tokenBucketStore";

import { RateLimitResult, TokenBucketRecord } from "../types";


export function tokenBucket(
    callerId: string,
    capacity: number,
    refillRate: number
): RateLimitResult{
  const now = Date.now();
  let bucket: TokenBucketRecord | undefined = tokenBucketStore.get(callerId);

  if (!bucket) {
    bucket = {
      tokens: capacity,
      lastRefill: now,
    };
  }
  // Calculate how mch time has passed since the last request
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;

  // Calculate how many tokens should be refilled

  const newTokens = elapsedSeconds * refillRate;

  bucket.tokens = Math.min(capacity, bucket.tokens + newTokens);

  bucket.lastRefill = now;

  // not enough tokens

  if (bucket.tokens < 1) {
    tokenBucketStore.set(callerId, bucket);

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((1 - bucket.tokens) / refillRate),
    };
  }

  // consume one token

  bucket.tokens -= 1;

  tokenBucketStore.set(callerId, bucket);

  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfter: 0,
  };
}