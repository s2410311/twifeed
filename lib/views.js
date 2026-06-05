import redis from "./redisClient.js";
import db from "../db/index.js";

const key = aid => `views:${aid}`;

export async function incrementView(aid) {
    await redis.incr(key(aid));
}

// DB baseline + Redis delta
export async function getViewCount(aid, dbCount) {
    const delta = parseInt(await redis.get(key(aid))) || 0;
    return dbCount + delta;
}

// Redisの差分をDBに書き込んでリセット
export async function flushAllViews() {
    const keys = await redis.keys("views:*");
    if (keys.length === 0) return 0;

    for (const k of keys) {
        const delta = parseInt(await redis.get(k)) || 0;
        if (delta <= 0) continue;

        const aid = parseInt(k.split(":")[1]);
        // deltaを先に差し引いてからDBに書く（取りこぼしを最小化）
        await redis.decrby(k, delta);
        db.prepare(
            "UPDATE articles SET view_count = view_count + ? WHERE aid = ?"
        ).run(delta, aid);
    }

    return keys.length;
}
