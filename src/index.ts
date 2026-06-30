import express from "express";
import { rateLimiter } from "./middleware/rateLimiter";

const app = express();

app.get(
  "/hello",
  rateLimiter({
    limit: 5,
    windowMs: 60_000,
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  (req, res) => {
    console.log("Route handler executed");

    res.status(200).json({
      message: "Hello! Your request was successful.",
    });
  },
);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
