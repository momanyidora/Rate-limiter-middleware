import { memoryStore } from "../stores/memoryStore";
import {redis, fixedWindowLua} from "../stores/redisStore";
import {FixedWindowRecord, RateLimitResult, StoreType } from "../types";

export async function fixedWindow(
    callerId: string,
     limit: number,
      windowMs: number,
      store: StoreType
    ): Promise<RateLimitResult>{

        const now = Date.now();

        let record: FixedWindowRecord | undefined;

        if(store === "memory"){
            record = memoryStore.get(callerId);
        
        }else{
            const result = (await redis.eval(
              fixedWindowLua,
              1,
              `fixed:${callerId}`,
              limit,
              windowMs,
              now,
            )) as number[];

            return {
              allowed: result[0] === 1,
              remaining: result[1],
              retryAfter: result[2],
            };
        }

        if(!record){
            record ={
                count: 0,
                windowStart: now
            };
        }
if(now - record.windowStart >= windowMs){
    record.count = 0;
    record.windowStart = now;
}
    
  record.count++

    memoryStore.set(callerId, record);

    return{
        allowed: record.count <= limit,
        remaining: Math.max(limit - record.count, 0),
        retryAfter: Math.ceil(
            (windowMs -(now - record.windowStart))/1000
        )
    }
}