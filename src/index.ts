import express from "express";
import { rateLimiter } from "./middleware/rateLimiter";

const app = express();

app.get(
  "/login",
  rateLimiter({
    algorithm: "fixed-window",
    limit: 5,
    windowMs: 60_000,
    store: "redis",
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  (req, res) => {
    console.log("Hello route");

    res.status(200).json({
      message: "Hello! Fixed window Rate Limiter",
    });
  },
);
app.get(
  "/search",
  rateLimiter({
    algorithm: "token-bucket",
    capacity: 10,
    refillRate: 2,
    store: "redis",
    
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  (req, res) => {
    console.log("Search route");

    res.status(200).json({
      message: "Search route using Token Bucket.",
    });
  },
);

app.get(
  "/users",
  rateLimiter({
    algorithm: "fixed-window",
    limit: 20,
    windowMs: 60_000,
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  (req, res) => {
    console.log("Users route");

    res.status(200).json({
      message: "Users route with its own Fixed Window limit.",
    });
  },
);
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
