import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("Fixed Window Concurrency", () => {
  it("should never allow more than the limit", async () => {
    const requests = [];

    for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get("/login")
            .set("X-Forwarded-For", "concurrency-fixed"),
        );
    }

    const responses = await Promise.all(requests);
    // console.log(responses.map((r) => r.status));
    const allowed = responses.filter((r) => r.status === 200);

    const blocked = responses.filter((r) => r.status === 429);

    expect(allowed.length).toBe(5);

    expect(blocked.length).toBe(15);
  });
});

describe("Token Bucket Concurrency", () => {
  it("should never allow more than bucket capacity", async () => {
    const requests = [];

    for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .get("/search")
            .set("X-Forwarded-For", "concurrency-bucket"),
        );
    }

    const responses = await Promise.all(requests);
    // console.log(responses.map((r) => r.status));

    const allowed = responses.filter((r) => r.status === 200);

    const blocked = responses.filter((r) => r.status === 429);

    expect(allowed.length).toBe(10);

    expect(blocked.length).toBe(20);
  });
});