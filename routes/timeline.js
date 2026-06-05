import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { getTimeline } from "../lib/timelineStore.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
    const uid = req.session.uid;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const aids = await getTimeline(uid, offset, limit);

    if (aids.length === 0) {
        return res.json({ articles: [], next_offset: null });
    }

    const placeholders = aids.map(() => "?").join(",");
    const articles = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.cid, a.created_at
        FROM articles a
        JOIN users u ON u.uid = a.uid
        WHERE a.aid IN (${placeholders})
        ORDER BY a.created_at DESC
    `).all(...aids);

    const next_offset = aids.length === limit ? offset + limit : null;

    res.json({ articles, next_offset });
});

export default router;
