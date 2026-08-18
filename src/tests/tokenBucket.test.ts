import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index";
import { redis } from "../stores/redisStore";

describe("Token Bucket", () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it("allows requests while tokens exist", async () => {
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
  .get("/search")
  .set("X-Forwarded-For", "bucket-1");
      expect(response.status).toBe(200);
    }
  });

  it("rejects when bucket becomes empty", async () => {
    for (let i = 0; i < 10; i++) {
        await request(app).get("/search").set("X-Forwarded-For", "bucket-2");
    }

    const response = await request(app)
  .get("/search")
  .set("X-Forwarded-For", "bucket-2");

    expect(response.status).toBe(429);
  });

  it("returns remaining tokens", async () => {
    const response = await request(app)
  .get("/search")
  .set("X-Forwarded-For", "bucket-3");

    expect(response.headers["x-ratelimit-remaining"]).toBe("9");
  });

  it("returns retry-after when empty", async () => {
    const caller = "bucket-4";

    for (let i = 0; i < 10; i++) {
      await request(app).get("/search").set("X-Forwarded-For", caller);
    }

    const response = await request(app)
      .get("/search")
      .set("X-Forwarded-For", caller);

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
  });

  it("stores buckets in redis", async () => {
    await request(app).get("/search").set("X-Forwarded-For", "bucket-4");

    const keys = await redis.keys("bucket:*");

    expect(keys.length).toBeGreaterThan(0);
  });
});
