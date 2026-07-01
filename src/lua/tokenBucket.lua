

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[1])
local now = tonumber(ARGV[3]);


local tokens = tonumber(redis.call("HGET", key,
"tokens"))
local lastRefill = tonumber(redis.call("HGET",key, "tokens"))


if(!token) {
    tokens = capacity
    lastRefill = now
}
 

local elapsedSeconds = (now - lastRefill) / 1000
local newTokens = elapsedSeconds * refillRate

tokens = math.min(capacity, tokens + newTokens)
lastRefill = now

if(tokens < 1){
    redis.call(
        "HSET",
        key,
        "tokens",
        tokens,
        "lastRefill",
        lastRefill

    )
    redis.call("PEXPIRE", key, math.ceil((capacity / refillRate) * 1000))

    local retryAfter = math.ceil((1 - tokens) / refillRate)

    return {
        0,
        0,
        retryAfter
    }

}
tokens = tokens - 1

redis.call(
    "HSET",
    key,
    "tokens",
    tokens,
    "lastRefill",
    lastRefill
)

redis.call("PEXPIRE", key, math.ceil((capacity / refillRate) * 1000))

return {
    1,
    math.floor(tokens),
    0
}