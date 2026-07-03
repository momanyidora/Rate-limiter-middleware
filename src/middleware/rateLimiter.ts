import { Request, Response, NextFunction } from "express";
import { fixedWindow } from "../algorithms/fixedWindow";
import { RateLimiterOptions, RateLimitResult } from "../types";
import { tokenBucket } from "../algorithms/tokenBucket";


export function rateLimiter(options: RateLimiterOptions) {
  return async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    const callerId = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip ?? "unknown");


  let result: RateLimitResult;

  const algorithm = options.algorithm ?? "fixed-window";

  if (algorithm === "fixed-window") {
    result = fixedWindow(callerId, options.limit!, options.windowMs!);

  } else {
    result = tokenBucket(callerId, options.capacity!, options.refillRate!);
  }

    // telling client how many requests are remain
    res.setHeader(
        "X-RateLimit-Remaining",
        result.remaining.toString()
    );

    if (!result.allowed) {

      res.setHeader(
        "Retry-After",
        result.retryAfter.toString()
      );
      res.status(429).json({
        message: "Too Many Requests",
      });

      return;
    }

    next();
  };
}