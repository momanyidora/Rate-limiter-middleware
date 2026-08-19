# Rate Limiter Middleware Control Flow Diagram

This diagram shows what happens in the running Express application when a
client calls one of the protected routes (`/login`, `/search`, or `/users`).
It describes the actual implementation in this project; it is not a proposed
future design.

```mermaid
flowchart TD
    client([Client sends an HTTP request<br/>to a protected API route]) --> express[Express matches the route<br/>and enters its middleware]
    express --> identity[1. Identify the caller<br/>keyGenerator: X-Forwarded-For, IP,<br/>API key, or user ID]
    identity --> config[2. Read the route's rate-limiter configuration<br/>algorithm, limit/capacity, refill/window, store]
    config --> check[3. Call the rate-limiter check<br/>caller ID plus route configuration]
    check --> allowlisted{Is this caller<br/>on the allowlist?}

    allowlisted -- Yes --> bypass[Skip rate limiting<br/>and call next()]
    bypass --> handler[Run the route handler]
    handler --> success([Return the route's HTTP response])

    allowlisted -- No --> storage{Configured store?}

    storage -- Memory --> mem_algo{Which algorithm?}
    mem_algo -- Fixed window --> mem_fixed[Read and update the in-memory<br/>counter for the current window]
    mem_algo -- Token bucket --> mem_bucket[Read bucket, refill tokens,<br/>then spend one token if available]

    storage -- Redis --> redis_algo{Which algorithm?}
    redis_algo -- Fixed window --> redis_fixed[Read fixed:callerId and atomically<br/>update count/window with a Lua script]
    redis_algo -- Token bucket --> redis_bucket[Read bucket:callerId and atomically<br/>refill/update tokens with a Lua script]

    mem_fixed --> decision{Allowed?}
    mem_bucket --> decision
    redis_fixed --> decision
    redis_bucket --> decision

    decision -- Yes --> remaining[4a. Set X-RateLimit-Remaining<br/>Call next()]
    remaining --> handler

    decision -- No --> rejected[4b. Set X-RateLimit-Remaining: 0<br/>Set Retry-After]
    rejected --> response429([Return 429 Too Many Requests])
```

## How it maps to the real routes

| Route     | Algorithm    | Limit configuration                          | Store                |
| --------- | ------------ | -------------------------------------------- | -------------------- |
| `/login`  | Fixed window | 5 requests per 60 seconds                    | Redis                |
| `/search` | Token bucket | Capacity 10; refill rate 0.001 tokens/second | Redis                |
| `/users`  | Fixed window | 20 requests per 60 seconds                   | Memory (the default) |

## What the important branches mean

- **Allowlist branch:** a caller listed through `POST /allowlist/:id` skips the
  limiter and reaches the handler immediately. The ID must match the one made
  by the route's `keyGenerator`.
- **Fixed-window branch:** each caller gets a counter. A request is allowed
  while the counter is no higher than the route limit; the counter resets when
  the window expires.
- **Token-bucket branch:** each caller has tokens up to the configured
  capacity. One token is spent per allowed request; tokens are refilled lazily
  when the next request arrives.
- **State update:** the limiter reads the caller's current counter or bucket,
  decides whether this request can proceed, and saves the updated state. For a
  token bucket, this includes refilling elapsed tokens before the decision.
- **Redis branch:** the Lua scripts keep the read, decision, and update
  together atomically, so concurrent requests cannot both claim the same
  remaining request/token.
- **Allowed branch:** `X-RateLimit-Remaining` is set before `next()` passes
  control to the route handler.
- **Rejected branch:** the route handler is never called. The client receives
  `429 Too Many Requests`, `Retry-After`, and `X-RateLimit-Remaining: 0`.

## Real-world example

A user sends six `/login` requests from the same `X-Forwarded-For` address in
one minute. Express uses that address as the caller ID, sees that it is not
allowlisted, and selects the fixed-window configuration for `/login`. The first
five requests are atomically counted in Redis and proceed to the login handler.
The sixth request receives `429 Too Many Requests` with the number of seconds
until the current 60-second window resets. A different caller ID has its own
separate counter and allowance.
