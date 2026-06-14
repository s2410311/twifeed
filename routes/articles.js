import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { incrementView, getViewCount, flushAllViews } from "../lib/views.js";
import { incrementExp, decrementExp, flushAllExp } from "../lib/exp.js";
import { createArticle } from "../service/articles.js";

const router = express.Router();

// 投稿検索
router.get("/search", requireAuth, (req, res) => {
    const q = (req.query.q ?? "").trim();
    const uid = req.session.uid;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const cid = req.query.cid ? parseInt(req.query.cid) : null;

    if (!q && !cid) return res.json({ articles: [], next_offset: null });

    const conditions = [];
    const params = [uid];

    if (q) {
        conditions.push("(a.content LIKE ? OR u.name LIKE ? OR a.uid LIKE ?)");
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (cid) {
        conditions.push("a.cid = ?");
        params.push(cid);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const articles = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.cid, a.created_at,
               COUNT(l.uid) AS like_count,
               MAX(CASE WHEN l.uid = ? THEN 1 ELSE 0 END) AS liked,
               (SELECT COUNT(*) FROM articles r WHERE r.root_aid = a.aid) AS reply_count,
               ui.url AS icon_url,
               c.name AS category_name,
               p.uid AS parent_uid, pu.name AS parent_name, p.content AS parent_content
        FROM articles a
        JOIN users u ON u.uid = a.uid
        LEFT JOIN likes l ON l.aid = a.aid
        LEFT JOIN user_images ui ON ui.id = a.uid
        LEFT JOIN categories c ON c.cid = a.cid
        LEFT JOIN articles p ON p.aid = a.parent_aid
        LEFT JOIN users pu ON pu.uid = p.uid
        ${where}
        GROUP BY a.aid
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    for (const a of articles) {
        a.images = db.prepare(
            "SELECT thumbnail_url, url FROM images WHERE aid = ? ORDER BY iid ASC"
        ).all(a.aid);
    }

    const next_offset = articles.length === limit ? offset + limit : null;
    res.json({ articles, next_offset });
});

// 投稿作成
router.post("/", requireAuth, async (req, res) => {
    const result = await createArticle(req.session.uid, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ aid: result.aid });
});

// 記事詳細（閲覧数をインクリメント）
router.get("/:aid", async (req, res) => {
    const aid = parseInt(req.params.aid);
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const article = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.cid, a.view_count, a.created_at,
               COUNT(l.uid) AS like_count
        FROM articles a
        JOIN users u ON u.uid = a.uid
        LEFT JOIN likes l ON l.aid = a.aid
        WHERE a.aid = ?
    `).get(aid);

    if (!article) return res.status(404).json({ error: "article not found" });

    await incrementView(aid);
    article.view_count = await getViewCount(aid, article.view_count);

    article.images = db.prepare(`
        SELECT iid, url, width, height, thumbnail_url, thumb_width, thumb_height
        FROM images WHERE aid = ? ORDER BY iid ASC
    `).all(aid);

    res.json(article);
});

// スレッド全体取得
router.get("/:aid/thread", requireAuth, (req, res) => {
    const aid = parseInt(req.params.aid);
    const uid = req.session.uid;
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const article = db.prepare("SELECT aid, root_aid FROM articles WHERE aid = ?").get(aid);
    if (!article) return res.status(404).json({ error: "article not found" });

    const rootAid = article.root_aid ?? article.aid;

    const articles = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.created_at,
               COUNT(l.uid) AS like_count,
               MAX(CASE WHEN l.uid = ? THEN 1 ELSE 0 END) AS liked,
               ui.url AS icon_url
        FROM articles a
        JOIN users u ON u.uid = a.uid
        LEFT JOIN likes l ON l.aid = a.aid
        LEFT JOIN user_images ui ON ui.id = a.uid
        WHERE a.aid = ? OR a.root_aid = ?
        GROUP BY a.aid
        ORDER BY a.created_at ASC
    `).all(uid, rootAid, rootAid);

    for (const a of articles) {
        a.images = db.prepare(
            "SELECT thumbnail_url, url FROM images WHERE aid = ? ORDER BY iid ASC"
        ).all(a.aid);
    }

    res.json({ articles, root_aid: rootAid });
});

// 直接の返信一覧
router.get("/:aid/replies", (req, res) => {
    const aid = parseInt(req.params.aid);
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const parent = db.prepare("SELECT aid FROM articles WHERE aid = ?").get(aid);
    if (!parent) return res.status(404).json({ error: "article not found" });

    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const replies = db.prepare(`
        SELECT a.aid, a.uid, u.name, a.content, a.parent_aid, a.root_aid, a.created_at
        FROM articles a
        JOIN users u ON u.uid = a.uid
        WHERE a.parent_aid = ?
        ORDER BY a.created_at ASC
        LIMIT ? OFFSET ?
    `).all(aid, limit, offset);

    const next_offset = replies.length === limit ? offset + limit : null;

    res.json({ replies, next_offset });
});

// 返信投稿
router.post("/:aid/replies", requireAuth, async (req, res) => {
    const parent_aid = parseInt(req.params.aid);
    if (isNaN(parent_aid)) return res.status(400).json({ error: "invalid aid" });

    const result = await createArticle(req.session.uid, { ...req.body, parent_aid });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ aid: result.aid });
});

// いいね
router.post("/:aid/likes", requireAuth, async (req, res) => {
    const aid = parseInt(req.params.aid);
    const uid = req.session.uid;
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const article = db.prepare("SELECT aid, uid FROM articles WHERE aid = ?").get(aid);
    if (!article) return res.status(404).json({ error: "article not found" });

    const existing = db.prepare("SELECT 1 FROM likes WHERE uid = ? AND aid = ?").get(uid, aid);
    if (existing) return res.status(409).json({ error: "already liked" });

    db.prepare(
        "INSERT INTO likes (uid, aid, created_at) VALUES (?, ?, ?)"
    ).run(uid, aid, Date.now());

    await incrementExp(article.uid);

    res.status(201).json({ ok: true });
});

// いいね解除
router.delete("/:aid/likes", requireAuth, async (req, res) => {
    const aid = parseInt(req.params.aid);
    const uid = req.session.uid;
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const article = db.prepare("SELECT uid FROM articles WHERE aid = ?").get(aid);
    if (!article) return res.status(404).json({ error: "article not found" });

    const result = db.prepare(
        "DELETE FROM likes WHERE uid = ? AND aid = ?"
    ).run(uid, aid);

    if (result.changes === 0) return res.status(404).json({ error: "not liked" });

    await decrementExp(article.uid);

    res.json({ ok: true });
});

// 閲覧数をDBにフラッシュ
router.post("/flush-views", async (req, res) => {
    const count = await flushAllViews();
    res.json({ flushed: count });
});

// 経験値をDBにフラッシュ
router.post("/flush-exp", async (req, res) => {
    const count = await flushAllExp();
    res.json({ flushed: count });
});

export default router;
