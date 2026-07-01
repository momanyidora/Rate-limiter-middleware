import Redis from "ioredis";
import path from "path";
import fs from "fs"


export const redis =  new Redis({
 host: process.env.REDIS_HOST || "127.0.0.1",
 port: Number(process.env.REDIS_PORT)  || 6379,
});


export const fixedWindowLua = fs.readFileSync(
    path.join(__dirname, "../lua/fixedWindow.lua"), "utf8"
);

export const tokenBucketLua = fs.readFileSync(
    path.join(__dirname, "../lua/tokenBucket.lua"), "utf8"
);