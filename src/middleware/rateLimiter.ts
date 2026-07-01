import { Request, Response, NextFunction } from "express";
import { fixedWindow } from "../algorithms/fixedWindow";
import { RateLimiterOptions, RateLimitResult } from "../types";
import { tokenBucket } from "../algorithms/tokenBucket";
import { isAllowlisted } from "../stores/allowlistStore";

export function rateLimiter(options: RateLimiterOptions) {
  return async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    const callerId = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip ?? "unknown");

      if (isAllowlisted(callerId)) {
        next();
        return;
      }
  let result: RateLimitResult;

  const algorithm = options.algorithm ?? "fixed-window";

  if (algorithm === "fixed-window") {
    result = await fixedWindow(callerId, options.limit!, options.windowMs!, options.store ?? "memory");

  } else {
    result = await tokenBucket(callerId, options.capacity!, options.refillRate!, options.store ?? "memory");
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