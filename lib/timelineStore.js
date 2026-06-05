import redis from "./redisClient.js";

const TIMELINE_MAX = 1000;
const key = uid => `timeline:${uid}`;

export async function pushToTimeline(uid, aid) {
    await redis.lpush(key(uid), aid);
    await redis.ltrim(key(uid), 0, TIMELINE_MAX - 1);
}

export async function getTimeline(uid, offset = 0, limit = 20) {
    const aids = await redis.lrange(key(uid), offset, offset + limit - 1);
    return aids.map(Number);
}
