
import { redis } from "../stores/redisStore";
import { tokenBucketStore } from "../stores/tokenBucketStore";

import { RateLimitResult, StoreType, TokenBucketRecord } from "../types";


export async function tokenBucket(
    callerId: string,
    capacity: number,
    refillRate: number,
    store: StoreType = "memory"
): Promise<RateLimitResult>{

  const now = Date.now();

  let bucket: TokenBucketRecord | undefined 



  if(store === "memory"){
    
    bucket = tokenBucketStore.get(callerId);
  }else{
    const data = await redis.get(`bucket:${callerId}`);

    if(data){
      bucket = JSON.parse(data)
    }
  }



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
    if(store === "memory"){
      tokenBucketStore.set(callerId, bucket);
    }else{
      await redis.set(`bucket:${callerId}`, JSON.stringify(bucket)
    );
    }
   return{
    allowed: false,
    remaining: 0,
    retryAfter: Math.ceil(
      (1 - bucket.tokens)/refillRate
    ),
   };
    }

    bucket.tokens--;


    if(store === "memory"){
       tokenBucketStore.set(callerId, bucket)
    }else{
      await redis.set(
        `bucket:${callerId}`, JSON.stringify(bucket)
      )
    }
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfter: 0,
  };
}