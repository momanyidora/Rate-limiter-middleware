import { Request, Response, NextFunction } from "express";
import { fixedWindow } from "../algorithms/fixedWindow";
import { RateLimiterOptions } from "../types";

export function rateLimiter(options: RateLimiterOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const callerId = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip ?? "unknown");

    const result = fixedWindow(callerId, options.limit, options.windowMs);

    // telling client how many requests are remain
    res.setHeader(
        "X-RateLimting Remaining",
        result.remaining.toString()
    );

    if (!result.allowed) {
      res.status(429).json({
        message: "Too Many Requests",
      });

      return;
    }

    next();
  };
}