# rate-limiter-middleware

A TypeScript middleware package for adding configurable rate limiting to Node.js applications.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## Project structure

- src/algorithms: rate limiting algorithms such as fixed window and token bucket
- src/middleware: middleware implementation
- src/stores: in-memory and Redis-backed stores
