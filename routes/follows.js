import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { buildTimeline } from "../service/timeline.js";

const router = express.Router();

// フォロー
router.post("/:uid", requireAuth, async (req, res) => {
    const follower_uid = req.session.uid;
    const followee_uid = req.params.uid;

    if (follower_uid === followee_uid) {
        return res.status(400).json({ error: "cannot follow yourself" });
    }

    const target = db.prepare("SELECT uid FROM users WHERE uid = ?").get(followee_uid);
    if (!target) return res.status(404).json({ error: "user not found" });

    const existing = db.prepare(
        "SELECT 1 FROM follows WHERE follower_uid = ? AND followee_uid = ?"
    ).get(follower_uid, followee_uid);
    if (existing) return res.status(409).json({ error: "already following" });

    db.prepare(
        "INSERT INTO follows (follower_uid, followee_uid, created_at) VALUES (?, ?, ?)"
    ).run(follower_uid, followee_uid, Date.now());

    await buildTimeline(follower_uid);

    res.status(201).json({ ok: true });
});

// フォロー解除
router.delete("/:uid", requireAuth, async (req, res) => {
    const follower_uid = req.session.uid;
    const followee_uid = req.params.uid;

    const result = db.prepare(
        "DELETE FROM follows WHERE follower_uid = ? AND followee_uid = ?"
    ).run(follower_uid, followee_uid);

    if (result.changes === 0) {
        return res.status(404).json({ error: "not following" });
    }

    await buildTimeline(follower_uid);

    res.json({ ok: true });
});

// フォロワー一覧（指定ユーザーをフォローしている人）
router.get("/:uid/followers", requireAuth, (req, res) => {
    const { uid } = req.params;
    const myUid = req.session.uid;

    const target = db.prepare("SELECT uid FROM users WHERE uid = ?").get(uid);
    if (!target) return res.status(404).json({ error: "user not found" });

    const rows = db.prepare(`
        SELECT u.uid, u.name, f.created_at,
               ui.url AS icon_url,
               CASE WHEN mf.follower_uid IS NOT NULL THEN 1 ELSE 0 END AS is_following
        FROM follows f
        JOIN users u ON u.uid = f.follower_uid
        LEFT JOIN user_images ui ON ui.id = u.uid
        LEFT JOIN follows mf ON mf.follower_uid = ? AND mf.followee_uid = u.uid
        WHERE f.followee_uid = ?
        ORDER BY f.created_at DESC
    `).all(myUid, uid);

    res.json(rows);
});

// フォロー中一覧（指定ユーザーがフォローしている人）
router.get("/:uid/following", requireAuth, (req, res) => {
    const { uid } = req.params;
    const myUid = req.session.uid;

    const target = db.prepare("SELECT uid FROM users WHERE uid = ?").get(uid);
    if (!target) return res.status(404).json({ error: "user not found" });

    const rows = db.prepare(`
        SELECT u.uid, u.name, f.created_at,
               ui.url AS icon_url,
               CASE WHEN mf.follower_uid IS NOT NULL THEN 1 ELSE 0 END AS is_following
        FROM follows f
        JOIN users u ON u.uid = f.followee_uid
        LEFT JOIN user_images ui ON ui.id = u.uid
        LEFT JOIN follows mf ON mf.follower_uid = ? AND mf.followee_uid = u.uid
        WHERE f.follower_uid = ?
        ORDER BY f.created_at DESC
    `).all(myUid, uid);

    res.json(rows);
});

export default router;
