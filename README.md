## In-Memory vs Redis (and the Distributed-State Limitation)

### The problem with in-memory storage

My first version of this limiter kept everything in a plain JS `Map` inside the process. That works fine on my laptop, but it quietly breaks in production.

Here's why: in production this service doesn't run as one instance, it runs as several, sitting behind a load balancer. Each instance has its own memory, which means each instance has its **own separate `Map`**. They don't know about each other.

So say a route is limited to 5 requests/minute, and there are 2 instances running. The load balancer doesn't care about rate limits when it routes traffic it might send 5 requests to instance A and 5 to instance B for the exact same caller. Each instance only sees its own 5 requests and thinks "that's within the limit, all good." Nobody ever sees all 10. The caller just got a 10-request allowance instead of 5.

Basically, the effective limit multiplies by however many instances you're running. 2 instances double the limit, 4 instances quadruple it, and so on, since traffic is roughly split between them.

On top of that, in-memory state doesn't survive a restart or a redeploy. The moment the process dies, the `Map` is gone and every caller's count resets to zero whether that was intentional or not.

This is fine for local dev and single-instance setups, but it's not something I'd trust in production.

### Why Redis fixes it

Redis lives outside any single instance, so instead of each server keeping its own counters, every instance reads and writes to the **same** store. Whether a request lands on instance A or instance B, they're both checking and updating the same counter for that caller so the limit actually means what it says.

### Choosing the store

The backend is just a config option, nothing hardcoded:

```js
rateLimiter({
  algorithm: "fixed-window",
  limit: 5,
  windowMs: 60000,
  store: "redis", // or "memory"
  keyGenerator: (req) => req.ip ?? "unknown"
})
```

`memory` is fine for local testing or single-instance runs. `redis` is the one to use anywhere that runs more than one instance which in practice means production.

The Redis connection itself is also configurable via env vars (`REDIS_HOST`, `REDIS_PORT`), not hardcoded anywhere in the code.

### Running it against Redis locally

Start Redis, then run the app as usual:

```bash
npm run dev
```

Hit the route a few times, then check Redis directly:

```bash
redis-cli
KEYS *
GET "fixed:<callerId>"
```

You should see the counter living in Redis instead of memory proof both algorithms are actually writing to the shared store now, not just to a local `Map`.

> **Note:** Redis storage alone doesn't make this concurrency-safe yet that's handled separately in the atomicity work (see the concurrency section below). This section is just about *where* the state lives, not about race conditions.