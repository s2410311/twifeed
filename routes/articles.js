import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { extractTags } from "../utils/extractTags.js";
import { pushToTimeline } from "../lib/timeline.js";
import { incrementView, getViewCount, flushAllViews } from "../lib/views.js";

const router = express.Router();

const insertArticleWithTags = db.transaction((uid, cid, parent_aid, root_aid, content) => {
    const { lastInsertRowid: aid } = db.prepare(`
        INSERT INTO articles (uid, cid, parent_aid, root_aid, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, cid, parent_aid, root_aid, content, Date.now());

    const tagNames = extractTags(content);
    const now = Date.now();

    for (const name of tagNames) {
        db.prepare(
            "INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)"
        ).run(name, now);

        const { tid } = db.prepare(
            "SELECT tid FROM tags WHERE name = ?"
        ).get(name);

        db.prepare(
            "INSERT OR IGNORE INTO a2t (aid, tid, created_at) VALUES (?, ?, ?)"
        ).run(aid, tid, now);
    }

    return aid;
});

async function createArticle(uid, { content, cid = null, parent_aid = null, image_ids = [] }) {
    if (!content || typeof content !== "string" || content.trim() === "") {
        return { error: "content is required", status: 400 };
    }
    if (content.length > 1000) {
        return { error: "content too long", status: 400 };
    }
    if (!Array.isArray(image_ids) || image_ids.length > 4) {
        return { error: "image_ids must be an array of up to 4", status: 400 };
    }

    let root_aid = null;
    if (parent_aid != null) {
        const parent = db.prepare("SELECT aid, root_aid FROM articles WHERE aid = ?").get(parent_aid);
        if (!parent) return { error: "parent article not found", status: 404 };
        root_aid = parent.root_aid ?? parent.aid;
    }

    const aid = insertArticleWithTags(uid, cid, parent_aid, root_aid, content.trim());

    // 画像を記事に紐付け（aid=NULLのものだけ対象にして他人の画像の乗っ取りを防ぐ）
    if (image_ids.length > 0) {
        const placeholders = image_ids.map(() => "?").join(",");
        db.prepare(
            `UPDATE images SET aid = ? WHERE iid IN (${placeholders}) AND aid IS NULL`
        ).run(aid, ...image_ids);
    }

    const followers = db.prepare(
        "SELECT follower_uid FROM follows WHERE followee_uid = ?"
    ).all(uid);

    await Promise.all([
        pushToTimeline(uid, aid),
        ...followers.map(f => pushToTimeline(f.follower_uid, aid))
    ]);

    return { aid };
}

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
router.post("/:aid/likes", requireAuth, (req, res) => {
    const aid = parseInt(req.params.aid);
    const uid = req.session.uid;
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const article = db.prepare("SELECT aid FROM articles WHERE aid = ?").get(aid);
    if (!article) return res.status(404).json({ error: "article not found" });

    const existing = db.prepare("SELECT 1 FROM likes WHERE uid = ? AND aid = ?").get(uid, aid);
    if (existing) return res.status(409).json({ error: "already liked" });

    db.prepare(
        "INSERT INTO likes (uid, aid, created_at) VALUES (?, ?, ?)"
    ).run(uid, aid, Date.now());

    res.status(201).json({ ok: true });
});

// いいね解除
router.delete("/:aid/likes", requireAuth, (req, res) => {
    const aid = parseInt(req.params.aid);
    const uid = req.session.uid;
    if (isNaN(aid)) return res.status(400).json({ error: "invalid aid" });

    const result = db.prepare(
        "DELETE FROM likes WHERE uid = ? AND aid = ?"
    ).run(uid, aid);

    if (result.changes === 0) return res.status(404).json({ error: "not liked" });

    res.json({ ok: true });
});

// 閲覧数をDBにフラッシュ
router.post("/flush-views", async (req, res) => {
    const count = await flushAllViews();
    res.json({ flushed: count });
});

export default router;
