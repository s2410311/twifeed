import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();
const GRAVITY = 1.5;

router.get("/long", requireAuth, async (req, res) => {
    const uid = req.session.uid;
    const since = Date.now() - 30 * 24 * 3600000;

    const articles = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.cid, a.created_at,
               COUNT(DISTINCT l.uid) AS like_count,
               (SELECT COUNT(*) FROM articles r WHERE r.root_aid = a.aid) AS reply_count,
               MAX(CASE WHEN l.uid = ? THEN 1 ELSE 0 END) AS liked,
               ui.url AS icon_url,
               c.name AS category_name
        FROM articles a
        JOIN users u ON u.uid = a.uid
        LEFT JOIN likes l ON l.aid = a.aid
        LEFT JOIN user_images ui ON ui.id = a.uid
        LEFT JOIN categories c ON c.cid = a.cid
        WHERE a.created_at >= ? AND a.parent_aid IS NULL
        GROUP BY a.aid
    `).all(uid, since);

    const scored = articles.map(a => {
        const hours = (Date.now() - a.created_at) / 3600000;
        return { ...a, _score: (a.like_count + a.reply_count * 2 + 1) / Math.pow(hours + 2, GRAVITY) };
    });
    scored.sort((a, b) => b._score - a._score);
    const top5 = scored.slice(0, 5).map(({ _score, ...a }) => a);

    res.json({ articles: top5 });
});

export default router;
