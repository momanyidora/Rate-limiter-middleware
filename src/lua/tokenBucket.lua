local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local tokens = tonumber(redis.call("HGET", key, "tokens"))
local lastRefill = tonumber(redis.call("HGET", key, "lastRefill"))

if not tokens then
    tokens = capacity
    lastRefill = now
end

-- refill tokens
local elapsed = (now - lastRefill) / 1000
tokens = math.min(capacity, tokens + (elapsed * refillRate))
lastRefill = now

-- consume one token
if tokens >= 1 then
    tokens = tokens - 1

    redis.call(
        "HSET",
        key,
        "tokens",
        tokens,
        "lastRefill",
        lastRefill
    )

    redis.call(
        "PEXPIRE",
        key,
        math.ceil((capacity / refillRate) * 1000)
    )

    return {
        1,
        math.floor(tokens),
        0
    }
end

-- reject request
redis.call(
    "HSET",
    key,
    "tokens",
    tokens,
    "lastRefill",
    lastRefill
)

redis.call(
    "PEXPIRE",
    key,
    math.ceil((capacity / refillRate) * 1000)
)

local retryAfter = math.ceil((1 - tokens) / refillRate)

return {
    0,
    0,
    retryAfter
}