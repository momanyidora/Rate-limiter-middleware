
import { redis, tokenBucketLua } from "../stores/redisStore";
import { tokenBucketStore } from "../stores/tokenBucketStore";

import { RateLimitResult, StoreType, TokenBucketRecord } from "../types";


export async function tokenBucket(
    callerId: string,
    capacity: number,
    refillRate: number,
    store: StoreType = "memory"
): Promise<RateLimitResult>{

  const now = Date.now();
  

  if(store === "redis"){
    
    const result = (await redis.eval(

      tokenBucketLua,
      1,
      `bucket:${callerId}`,
      capacity,
      refillRate,
      now
    )) as number[];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfter: result[2],
    };
  }

  let bucket: TokenBucketRecord | undefined =
    tokenBucketStore.get(callerId);

  if (!bucket) {
    bucket = {
      tokens: capacity,
      lastRefill: now,
    };
  }

  const elapsedSeconds =
    (now - bucket.lastRefill) / 1000;

  const newTokens =
    elapsedSeconds * refillRate;

  bucket.tokens = Math.min(
    capacity,
    bucket.tokens + newTokens
  );

  bucket.lastRefill = now;

  if (bucket.tokens < 1) {

    tokenBucketStore.set(callerId, bucket);

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(
        (1 - bucket.tokens) / refillRate
      ),
    };
  }

  bucket.tokens--;

  tokenBucketStore.set(callerId, bucket);

  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfter: 0,
  };
}