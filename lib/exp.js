import redis from "./redisClient.js";
import db from "../db/index.js";

const key = uid => `exp:${uid}`;

export async function incrementExp(uid) {
    await redis.incr(key(uid));
}

export async function decrementExp(uid) {
    await redis.decr(key(uid));
}

export async function flushAllExp() {
    const keys = await redis.keys("exp:*");
    if (keys.length === 0) return 0;

    for (const k of keys) {
        const delta = parseInt(await redis.get(k)) || 0;
        if (delta === 0) continue;

        const uid = k.slice("exp:".length);
        await redis.decrby(k, delta);
        db.prepare(
            "UPDATE users SET exp = CAST(MAX(COALESCE(CAST(exp AS INTEGER), 0) + ?, 0) AS TEXT) WHERE uid = ?"
        ).run(delta, uid);
    }

    return keys.length;
}
