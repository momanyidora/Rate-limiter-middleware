# Rate Limiter Middleware

Configurable rate-limiting middleware for Express. Supports fixed window and token bucket algorithms, per-route config, an in-memory or Redis-backed store, and a runtime allowlist for trusted callers.

## What This Middleware Does

This middleware sits in front of any route and decides whether a request gets to reach the handler or not, based on how many requests that caller has already made.

It supports two algorithms (fixed window and token bucket), and you pick which one a route uses and what its limits are nothing is hardcoded. Rejected requests get a proper `429` with the right headers so clients know when to try again. State can live in memory (fine for local dev) or in Redis (needed once you're running more than one instance, which is basically always in production). There's also an allowlist so trusted callers (internal services, monitoring, etc.) can skip the limits entirely, and you can change that allowlist while the server is running no restart needed.

## Installation

```bash
npm install
```

You'll also need Redis running locally if you want to test the Redis-backed store (the memory store works with zero setup):

```bash
# however you normally run redis, e.g.
redis-server
```

Env vars for the Redis connection (both optional, they fall back to sensible defaults):

```
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Start the dev server:

```bash
npm run dev
```

## Running Tests

```bash
npm test
```

or for a single run without watch mode:

```bash
npm run test:run
```

Make sure Redis is running before you run the tests a chunk of them hit the Redis-backed store directly.

## Protecting a Route

Wrap any route with `rateLimiter(options)` and it runs before your handler. If the caller's over their limit, the handler never even runs.

```ts
import { rateLimiter } from "./middleware/rateLimiter";

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
    res.status(200).json({ message: "Hello! Fixed window Rate Limiter" });
  }
);
```

`keyGenerator` is how you decide what counts as "one caller" could be IP, an API key, a user id, whatever makes sense for that route. If you don't pass one, it defaults to `req.ip`.

## Configuring Limits Per Route

Every route configures its own algorithm and its own limits you're not stuck with one global setting. Here are three routes doing three different things:

**Fixed window, 5 requests/minute (login route strict, since it's auth):**

```ts
app.get(
  "/login",
  rateLimiter({
    algorithm: "fixed-window",
    limit: 5,
    windowMs: 60_000,
    store: "redis",
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  loginHandler
);
```

**Token bucket, capacity 10 and refills 2/sec (search route allows bursts):**

```ts
app.get(
  "/search",
  rateLimiter({
    algorithm: "token-bucket",
    capacity: 10,
    refillRate: 2,
    store: "redis",
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  searchHandler
);
```

**Fixed window, a more generous 20/minute (users route):**

```ts
app.get(
  "/users",
  rateLimiter({
    algorithm: "fixed-window",
    limit: 20,
    windowMs: 60_000,
    store: "redis",
    keyGenerator: (req) => req.ip ?? "unknown",
  }),
  usersHandler
);
```

If a route doesn't pass `algorithm`, it defaults to `fixed-window`. None of this requires touching the middleware's internal code it's all just the options object per route.

## Choosing an Algorithm (Token Bucket vs Fixed Window)

**Fixed window** keeps one counter per caller for a fixed chunk of time (say, 60 seconds). Every request bumps the counter, and once it's over the limit, everything else in that window gets rejected. When the window rolls over, the counter resets to zero. Simple, but it has a known weak spot: the "boundary burst" problem if a caller sends their whole allowance right at the very end of one window, then immediately sends another full allowance right at the start of the next window, they've effectively gotten double the limit in a very short span, even though neither window individually went over.

**Token bucket** doesn't work in fixed chunks of time at all. A caller has a bucket that holds up to `capacity` tokens, and each request costs one. Tokens refill steadily at `refillRate` per second, calculated lazily from elapsed time (no background timers, since the sprint doesn't allow those). This means a caller who's been idle can burst up to the full capacity in one go, but they can never sustain more than the refill rate over time the bucket just runs dry if they try. It doesn't have the boundary burst issue because there's no fixed boundary to exploit; it's a rolling allowance instead of a reset-on-a-clock one.

Short version: use fixed window when you want something simple and predictable (like login attempts), use token bucket when you want to allow occasional bursts but still cap the average rate (like search).

## The Response Headers

Every response allowed or rejected gets `X-RateLimit-Remaining`, telling the caller how many requests (or tokens) they've got left in the current allowance.

A rejected request additionally gets:

- **`429 Too Many Requests`** the status code
- **`Retry-After`** how many seconds until the caller can try again

`Retry-After` is computed differently depending on the algorithm, because "try again" means different things for each:

- **Fixed window** time left until the current window resets
- **Token bucket** time until enough tokens have refilled to allow one more request

Allowed requests never get a `429`, obviously, but they still carry `X-RateLimit-Remaining` so clients can see how close they are to the limit before they hit it.

## In-Memory vs Redis (and the Distributed-State Limitation)

### The problem with in-memory storage

My first version of this limiter kept everything in a plain JS `Map` inside the process. That works fine on my laptop, but it quietly breaks in production.

Here's why: in production this service doesn't run as one instance, it runs as several, sitting behind a load balancer. Each instance has its own memory, which means each instance has its **own separate `Map`**. They don't know about each other.

So say a route is limited to 5 requests/minute, and there are 2 instances running. The load balancer doesn't care about rate limits when it routes traffic it might send 5 requests to instance A and 5 to instance B for the exact same caller. Each instance only sees its own 5 requests and thinks "that's within the limit, all good." Nobody ever sees all 10. The caller just got a 10-request allowance instead of 5.

Basically, the effective limit multiplies by however many instances you're running. 2 instances double the limit, 4 instances quadruple it, and so on, since traffic is roughly split between them.

On top of that, in-memory state doesn't survive a restart or a redeploy. The moment the process dies, the `Map` is gone and every caller's count resets to zero, whether that was intentional or not.

This is fine for local dev and single-instance setups, but it's not something I'd trust in production.

### Why Redis fixes it

Redis lives outside any single instance, so instead of each server keeping its own counters, every instance reads and writes to the **same** store. Whether a request lands on instance A or instance B, they're both checking and updating the same counter for that caller, so the limit actually means what it says.

### Choosing the store

The backend is just a config option, nothing hardcoded:

```ts
rateLimiter({
  algorithm: "fixed-window",
  limit: 5,
  windowMs: 60000,
  store: "redis", // or "memory"
  keyGenerator: (req) => req.ip ?? "unknown",
});
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

 Note: Redis storage alone doesn't make this concurrency-safe by itself that's handled separately below. This section is just about *where* the state lives, not about race conditions.

## Running the Concurrency Tests

The check-and-update for a request (read the count/tokens -> check against the limit -> update -> write back) is a classic race condition waiting to happen. If two requests from the same caller land at the same instant, they can both read the same starting value, both decide there's room, and both get admitted which means the caller just got let in over the limit.

To fix this, both algorithms' Redis path uses a Lua script (`src/lua/tokenBucket.lua`, and the equivalent for fixed window) run through `redis.eval(...)`. Redis executes Lua scripts as a single atomic operation, so nothing can interleave in the middle of a check-and-update even though the token bucket logic involves several steps (read, refill, compare, consume, save) rather than one simple command.

The concurrency tests prove this by firing a batch of requests for one caller all at once with `Promise.all`, then checking that the number of `200`s never goes over the configured limit:

```bash
npm run test:run
```

specifically:

```
src/tests/concurrency.test.ts
```

This covers both algorithms for `/login` (fixed window, limit 5) it fires 20 requests at once and expects exactly 5 to succeed and 15 to get a `429`. For `/search` (token bucket, capacity 10) it fires 30 at once and expects exactly 10 to succeed. If the atomicity was broken, you'd see more than 5 or more than 10 succeed the whole point of these tests is to make that impossible to miss.

Each test file uses its own `X-Forwarded-For` value as the caller id, so the fixed window tests, token bucket tests, and concurrency tests don't end up sharing counters and stepping on each other when they run in parallel.

## The Allowlist

Some callers internal services, monitoring, trusted partners shouldn't be rate-limited at all, and the sprint's requirement injection means I couldn't take the server down to configure that.

The allowlist is a simple in-memory set of caller ids, checked right at the top of the middleware, before any limiting logic runs:

```
caller comes in
   -> allowlisted? -> yes -> skip straight to the handler
                  -> no  -> run through the normal limiter
```

It matches on the exact same identifier the limiter itself uses (whatever `keyGenerator` returns IP by default), so there's no mismatch between what's blocked and what's allowed.

### Viewing and changing the allowlist

There are three routes for managing it while the server is running:

```bash
# view current allowlist
curl http://localhost:3000/allowlist

# add a caller
curl -X POST http://localhost:3000/allowlist/127.0.0.1

# remove a caller
curl -X DELETE http://localhost:3000/allowlist/127.0.0.1
```

Adding a caller takes effect on their very next request no restart. Same for removing one; the moment they're off the list, normal limits apply again on their next request.

## Known Limitations

- The allowlist itself lives in memory, not Redis so if you run multiple instances, each instance has its own allowlist and you'd need to update all of them (or move it to Redis too, which I didn't get to in this sprint).
- Retry-After for the token bucket is rounded up to the nearest second, so it can occasionally tell a caller to wait a touch longer than strictly necessary.
- There's no persistence/backup for the Redis store beyond whatever Redis itself is configured to do if Redis goes down, this falls back to whatever the `store` option is set to per route (or fails, if a route is hardcoded to `"redis"` with no fallback).
- Clock skew between instances isn't accounted for this assumes all instances have roughly synced system clocks, which is a reasonable assumption but not a guarantee.