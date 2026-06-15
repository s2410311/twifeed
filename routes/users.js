import express from "express";
import multer from "multer";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import redis from "../lib/redisClient.js";
import { regenerateAuthenticatedSession } from "../service/sessionAuth.js";
import { expToLevel, levelToExp } from "../utils/level.js";
import { processAvatar, isAllowedType } from "../utils/processImage.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (isAllowedType(file.mimetype)) cb(null, true);
        else cb(new Error("unsupported image type"));
    },
});

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
    const uid = req.session.uid;
    const user = db.prepare(
        "SELECT uid, name, email, department, COALESCE(CAST(exp AS INTEGER), 0) AS exp FROM users WHERE uid = ?"
    ).get(uid);

    if (!user) return res.status(404).json({ error: "user not found" });

    const delta = parseInt(await redis.get(`exp:${uid}`)) || 0;
    const totalExp = Math.max(user.exp + delta, 0);

    const level = expToLevel(totalExp);
    const expForNext = levelToExp(level + 1);

    const iconRow = db.prepare("SELECT url FROM user_images WHERE id = ?").get(uid);

    res.json({
        uid: user.uid,
        name: user.name,
        email: user.email,
        department: user.department ?? null,
        level,
        exp: totalExp,
        exp_to_next: expForNext - totalExp,
        icon_url: iconRow?.url ?? null,
    });
});

router.post("/me/icon", requireAuth, upload.single("icon"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no image provided" });
    try {
        const uid = req.session.uid;
        const { url } = await processAvatar(req.file.buffer, req.file.mimetype);
        db.prepare(
            "INSERT OR REPLACE INTO user_images (id, uid, url, created_at) VALUES (?, ?, ?, ?)"
        ).run(uid, uid, url, Date.now());
        res.json({ url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.use((err, _req, res, _next) => {
    res.status(400).json({ error: err.message });
});

const changeUid = db.transaction((oldUid, newUid) => {
    db.prepare("UPDATE users     SET uid          = ? WHERE uid          = ?").run(newUid, oldUid);
    db.prepare("UPDATE passkeys  SET uid          = ? WHERE uid          = ?").run(newUid, oldUid);
    db.prepare("UPDATE follows   SET follower_uid = ? WHERE follower_uid = ?").run(newUid, oldUid);
    db.prepare("UPDATE follows   SET followee_uid = ? WHERE followee_uid = ?").run(newUid, oldUid);
    db.prepare("UPDATE articles  SET uid          = ? WHERE uid          = ?").run(newUid, oldUid);
    db.prepare("UPDATE likes     SET uid          = ? WHERE uid          = ?").run(newUid, oldUid);
    db.prepare("UPDATE timeline  SET uid          = ? WHERE uid          = ?").run(newUid, oldUid);
    db.prepare("UPDATE user_images SET uid        = ? WHERE uid          = ?").run(newUid, oldUid);
});

router.patch("/me", requireAuth, async (req, res) => {
    const { uid: newUid, name, email, department } = req.body;
    const oldUid = req.session.uid;

    if (newUid !== undefined) {
        if (typeof newUid !== "string" || newUid.trim() === "") {
            return res.status(400).json({ error: "invalid uid" });
        }
        const trimmed = newUid.trim();
        if (trimmed !== oldUid) {
            const conflict = db.prepare("SELECT uid FROM users WHERE uid = ?").get(trimmed);
            if (conflict) return res.status(409).json({ error: "uid already taken" });
            changeUid(oldUid, trimmed);
            await regenerateAuthenticatedSession(req, res, trimmed);
        }
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
        return res.status(400).json({ error: "invalid name" });
    }
    if (email !== undefined && (typeof email !== "string" || email.trim() === "")) {
        return res.status(400).json({ error: "invalid email" });
    }

    const currentUid = newUid?.trim() ?? oldUid;

    if (email !== undefined) {
        const conflict = db.prepare(
            "SELECT uid FROM users WHERE email = ? AND uid != ?"
        ).get(email.trim(), currentUid);
        if (conflict) return res.status(409).json({ error: "email already taken" });
    }

    const VALID_DEPARTMENTS = new Set([
        "人文・文化学群", "社会・国際学群", "人間学群", "生命環境学群",
        "情報学群", "医学群", "体育専門学群", "芸術専門学群", "総合学域群",
    ]);
    if (department !== undefined && department !== null && !VALID_DEPARTMENTS.has(department)) {
        return res.status(400).json({ error: "invalid department" });
    }

    const fields = [];
    const values = [];
    if (name !== undefined)       { fields.push("name = ?");       values.push(name.trim()); }
    if (email !== undefined)      { fields.push("email = ?");      values.push(email.trim()); }
    if (department !== undefined) { fields.push("department = ?"); values.push(department ?? null); }

    if (fields.length > 0) {
        values.push(currentUid);
        db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE uid = ?`).run(...values);
    }

    res.json({ ok: true });
});

// 公開プロフィール（/me より後に定義）
router.get("/:uid", requireAuth, (req, res) => {
    const { uid } = req.params;
    const myUid = req.session.uid;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const user = db.prepare(
        "SELECT uid, name, department FROM users WHERE uid = ?"
    ).get(uid);
    if (!user) return res.status(404).json({ error: "user not found" });

    const follower_count = db.prepare(
        "SELECT COUNT(*) AS c FROM follows WHERE followee_uid = ?"
    ).get(uid).c;

    const following_count = db.prepare(
        "SELECT COUNT(*) AS c FROM follows WHERE follower_uid = ?"
    ).get(uid).c;

    const is_following = !!db.prepare(
        "SELECT 1 FROM follows WHERE follower_uid = ? AND followee_uid = ?"
    ).get(myUid, uid);

    const iconRow = db.prepare("SELECT url FROM user_images WHERE id = ?").get(uid);

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
        WHERE a.uid = ?
        GROUP BY a.aid
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `).all(myUid, uid, limit, offset);

    for (const a of articles) {
        a.images = db.prepare(
            "SELECT thumbnail_url, url FROM images WHERE aid = ? ORDER BY iid ASC"
        ).all(a.aid);
    }

    const next_offset = articles.length === limit ? offset + limit : null;

    res.json({
        user: { ...user, follower_count, following_count, is_following, icon_url: iconRow?.url ?? null },
        articles,
        next_offset,
    });
});

export default router;
