import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/:name/articles", requireAuth, (req, res) => {
    const name = req.params.name;
    const uid = req.session.uid;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const tag = db.prepare("SELECT tid FROM tags WHERE name = ?").get(name);
    if (!tag) return res.json({ articles: [], next_offset: null });

    const articles = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.created_at,
               COUNT(l.uid) AS like_count,
               MAX(CASE WHEN l.uid = ? THEN 1 ELSE 0 END) AS liked,
               (SELECT COUNT(*) FROM articles r WHERE r.root_aid = a.aid) AS reply_count
        FROM articles a
        JOIN users u ON u.uid = a.uid
        JOIN a2t ON a2t.aid = a.aid
        LEFT JOIN likes l ON l.aid = a.aid
        WHERE a2t.tid = ?
        GROUP BY a.aid
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `).all(uid, tag.tid, limit, offset);

    for (const a of articles) {
        a.images = db.prepare(
            "SELECT thumbnail_url, url FROM images WHERE aid = ? ORDER BY iid ASC"
        ).all(a.aid);
    }

    const next_offset = articles.length === limit ? offset + limit : null;
    res.json({ articles, next_offset });
});

export default router;
