import { memoryStore } from "../stores/memoryStore";
import {redis} from "../stores/redisStore";
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
            const data = await redis.get(`fixed:${callerId}`);
            if(data){
                record = JSON.parse(data);
            }
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
   
  if(store === "memory"){
    memoryStore.set(callerId, record);
  }else{
    await redis.set(
        `fixed:${callerId}`,
        JSON.stringify(record)
    );
  }
    return{
        allowed: record.count <= limit,
        remaining: Math.max(limit - record.count, 0),
        retryAfter: Math.ceil(
            (windowMs -(now - record.windowStart))/1000
        )
    }
}