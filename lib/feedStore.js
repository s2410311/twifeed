import redis from "./redisClient.js";
import db from "../db/index.js";

const GRAVITY = 1.5;
const FEED_WINDOW_DAYS = 7;
const FEED_MAX = 1000;

const globalKey = () => "feed:all";
const categoryKey = cid => `feed:cid:${cid}`;

function calcScore(likeCount, replyCount, createdAt) {
    const hoursElapsed = (Date.now() - createdAt) / 3600000;
    return (likeCount + replyCount * 2 + 1) / Math.pow(hoursElapsed + 2, GRAVITY);
}

export async function addToFeed(aid, cid, createdAt = Date.now()) {
    const score = calcScore(0, 0, createdAt);
    await redis.zadd(globalKey(), score, aid);
    await redis.zremrangebyrank(globalKey(), 0, -(FEED_MAX + 1));
    if (cid) {
        await redis.zadd(categoryKey(cid), score, aid);
        await redis.zremrangebyrank(categoryKey(cid), 0, -(FEED_MAX + 1));
    }
}

export async function getFeed(cid, offset = 0, limit = 20) {
    const key = cid ? categoryKey(cid) : globalKey();
    const aids = await redis.zrevrange(key, offset, offset + limit - 1);
    return aids.map(Number);
}

export async function rebuildFeed() {
    const since = Date.now() - FEED_WINDOW_DAYS * 86400000;
    const articles = db.prepare(`
        SELECT a.aid, a.cid, a.created_at,
               COUNT(DISTINCT l.uid) AS like_count,
               (SELECT COUNT(*) FROM articles r WHERE r.root_aid = a.aid) AS reply_count
        FROM articles a
        LEFT JOIN likes l ON l.aid = a.aid
        WHERE a.created_at >= ? AND a.parent_aid IS NULL
        GROUP BY a.aid
    `).all(since);

    if (articles.length === 0) return;

    const pipeline = redis.pipeline();

    pipeline.del(globalKey());
    const cidsSeen = new Set();
    for (const a of articles) {
        if (a.cid) {
            if (!cidsSeen.has(a.cid)) {
                pipeline.del(categoryKey(a.cid));
                cidsSeen.add(a.cid);
            }
        }
    }

    for (const a of articles) {
        const score = calcScore(a.like_count, a.reply_count, a.created_at);
        pipeline.zadd(globalKey(), score, a.aid);
        if (a.cid) pipeline.zadd(categoryKey(a.cid), score, a.aid);
    }

    pipeline.zremrangebyrank(globalKey(), 0, -(FEED_MAX + 1));
    for (const cid of cidsSeen) {
        pipeline.zremrangebyrank(categoryKey(cid), 0, -(FEED_MAX + 1));
    }

    await pipeline.exec();
}
