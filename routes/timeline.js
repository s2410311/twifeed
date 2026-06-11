import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { getTimeline } from "../lib/timelineStore.js";
import { getFeed } from "../lib/feedStore.js";

const router = express.Router();

const ARTICLE_SELECT = `
    SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.cid, a.created_at,
           COUNT(l.uid) AS like_count,
           MAX(CASE WHEN l.uid = ? THEN 1 ELSE 0 END) AS liked,
           (SELECT COUNT(*) FROM articles r WHERE r.root_aid = a.aid) AS reply_count,
           p.uid AS parent_uid, pu.name AS parent_name, p.content AS parent_content,
           ui.url AS icon_url,
           c.name AS category_name
    FROM articles a
    JOIN users u ON u.uid = a.uid
    LEFT JOIN likes l ON l.aid = a.aid
    LEFT JOIN articles p ON p.aid = a.parent_aid
    LEFT JOIN users pu ON pu.uid = p.uid
    LEFT JOIN user_images ui ON ui.id = a.uid
    LEFT JOIN categories c ON c.cid = a.cid
`;

router.get("/", requireAuth, async (req, res) => {
    const uid = req.session.uid;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const mode = req.query.mode === "all" ? "all" : "following";
    const cid = req.query.cid ? parseInt(req.query.cid) : null;

    let articles;

    if (mode === "all") {
        const aids = await getFeed(cid, offset, limit);
        if (aids.length === 0) return res.json({ articles: [], next_offset: null });
        const placeholders = aids.map(() => "?").join(",");
        articles = db.prepare(`${ARTICLE_SELECT} WHERE a.aid IN (${placeholders}) GROUP BY a.aid ORDER BY a.created_at DESC`).all(uid, ...aids);
    } else {
        const aids = await getTimeline(uid, offset, limit);
        if (aids.length === 0) return res.json({ articles: [], next_offset: null });
        const placeholders = aids.map(() => "?").join(",");
        articles = db.prepare(`${ARTICLE_SELECT} WHERE a.aid IN (${placeholders}) GROUP BY a.aid ORDER BY a.created_at DESC`).all(uid, ...aids);
    }

    for (const a of articles) {
        a.images = db.prepare("SELECT thumbnail_url, url FROM images WHERE aid = ? ORDER BY iid ASC").all(a.aid);
    }

    const next_offset = articles.length === limit ? offset + limit : null;
    res.json({ articles, next_offset });
});

export default router;
