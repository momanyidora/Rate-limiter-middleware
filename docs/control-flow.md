# Rate Limiter Middleware — Control Flow Diagram

This diagram shows how a request moves through the Rate Limiter Middleware.

```mermaid
flowchart TD
    A([Client sends request]) --> B[Express API Route]

    B --> C[Rate Limiter Middleware]

    C --> D[Identify Client<br/>X-Forwarded-For / IP]

    D --> E{Which algorithm?}

    E -->|Fixed Window| F[Fixed Window Algorithm]
    E -->|Token Bucket| G[Token Bucket Algorithm]

    F --> H[(Redis)]
    G --> H

    H --> I[Redis Lua Script<br/>Atomic check + update]

    I --> J{Request allowed?}

    J -->|Yes| K[Set X-RateLimit-Remaining]
    K --> L[next()]
    L --> M[Route Handler]
    M --> N([200 OK])

    J -->|No| O[Set X-RateLimit-Remaining]
    O --> P[Set Retry-After]
    P --> Q([429 Too Many Requests])

    H -.->|fixed:clientId| F
    H -.->|bucket:clientId| G
```