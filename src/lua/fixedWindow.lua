local key = KEYS[1]

local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local count = tonumber(redis.call("HGET", key, "count"))
local windowStart = tonumber(redis.call("HGET", key, "windowStart"))

if not count then
    count = 0
    windowStart = now
end

if (now - windowStart) >= windowMs then
    count = 0
    windowStart = now
end

count = count + 1

redis.call("HSET", key,
    "count", count,
    "windowStart", windowStart
)

redis.call("PEXPIRE", key, windowMs)

local allowed = 0

if count <= limit then
    allowed = 1
end

local remaining = math.max(limit - count, 0)

local retryAfter = math.ceil(
    (windowMs - (now - windowStart)) / 1000
)

return {
    allowed,
    remaining,
    retryAfter
}