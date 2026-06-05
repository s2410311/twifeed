import db from "../db/index.js";
import redis from "../lib/redisClient.js";

const TIMELINE_MAX = 1000;
const key = uid => `timeline:${uid}`;

export async function buildTimeline(uid) {
    const followees = db.prepare(
        "SELECT followee_uid FROM follows WHERE follower_uid = ?"
    ).all(uid);

    const uids = [uid, ...followees.map(f => f.followee_uid)];
    const placeholders = uids.map(() => "?").join(",");

    const articles = db.prepare(`
        SELECT aid FROM articles
        WHERE uid IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT ?
    `).all(...uids, TIMELINE_MAX);

    await redis.del(key(uid));

    if (articles.length > 0) {
        await redis.rpush(key(uid), ...articles.map(a => String(a.aid)));
    }
}
