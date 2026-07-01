import express from "express";
import { rateLimiter } from "./middleware/rateLimiter";
import allowlistRoutes from "./routes/allowlistRoutes"

export const app = express();
// app.set("trust proxy");

app.use("/allowlist", allowlistRoutes);

app.get(
  "/login",
  rateLimiter({
    algorithm: "fixed-window",
    limit: 5,
    windowMs: 60_000,
    store: "redis",
    keyGenerator: (req) =>
      (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown",
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
    refillRate: 0.001,
    store: "redis",

    keyGenerator: (req) =>
      (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown",
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
    keyGenerator: (req) =>
      (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown",
  }),
  (req, res) => {
    console.log("Users route");

    res.status(200).json({
      message: "Users route with its own Fixed Window limit.",
    });
  },
);

const PORT = 3000;
if(require.main === module){
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
}