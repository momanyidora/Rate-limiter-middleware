import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index";
import { redis } from "../stores/redisStore";

describe("Fixed Window", () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it("allows requests up to the limit", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
  .get("/login")
  .set("X-Forwarded-For", "fixed-window-test-1");

      expect(response.status).toBe(200);
    }
  });

  it("rejects the request after the limit", async () => {
    const caller = "fixed-window-test-2";

    for (let i = 0; i < 5; i++) {
      await request(app).get("/login").set("X-Forwarded-For", caller);
    }

    const response = await request(app)
      .get("/login")
      .set("X-Forwarded-For", caller);

    expect(response.status).toBe(429);
  });

  it("returns remaining requests", async () => {

    const response = await request(app)
  .get("/login")
  .set("X-Forwarded-For", "fixed-window-test-4");

    expect(response.headers["x-ratelimit-remaining"]).toBe("4");
  });

  it("returns retry-after header when blocked", async () => {
    const caller = "fixed-window-test-5";

    for (let i = 0; i < 5; i++) {
      await request(app).get("/login").set("X-Forwarded-For", caller);
    }

    const response = await request(app)
      .get("/login")
      .set("X-Forwarded-For", caller);

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
  });
  it("stores counters in redis", async () => {
    await request(app)
  .get("/login")
  .set("X-Forwarded-For", "fixed-window-test-7");

    const keys = await redis.keys("fixed:*");

    expect(keys.length).toBeGreaterThan(0);
  });
  
});
