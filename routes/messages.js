import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { notifyUser } from "../lib/sseClients.js";

const router = express.Router();

// 受信トレイ（会話一覧）
router.get("/", requireAuth, (req, res) => {
    const uid = req.session.uid;

    const convos = db.prepare(`
        SELECT
            p.partner_uid,
            u.name  AS partner_name,
            ui.url  AS partner_icon,
            m.content       AS last_content,
            m.created_at    AS last_created_at,
            m.sender_uid    AS last_sender_uid,
            (
                SELECT COUNT(*) FROM messages
                WHERE sender_uid = p.partner_uid AND receiver_uid = ? AND read_at IS NULL
            ) AS unread_count
        FROM (
            SELECT DISTINCT
                CASE WHEN sender_uid = ? THEN receiver_uid ELSE sender_uid END AS partner_uid
            FROM messages
            WHERE sender_uid = ? OR receiver_uid = ?
        ) p
        JOIN users u ON u.uid = p.partner_uid
        LEFT JOIN user_images ui ON ui.id = p.partner_uid
        JOIN messages m ON m.mid = (
            SELECT mid FROM messages
            WHERE (sender_uid = ? AND receiver_uid = p.partner_uid)
               OR (sender_uid = p.partner_uid AND receiver_uid = ?)
            ORDER BY created_at DESC LIMIT 1
        )
        ORDER BY m.created_at DESC
    `).all(uid, uid, uid, uid, uid, uid);

    res.json(convos);
});

// 会話取得 + 既読処理
router.get("/:uid", requireAuth, (req, res) => {
    const myUid    = req.session.uid;
    const otherUid = req.params.uid;

    db.prepare(`
        UPDATE messages SET read_at = ?
        WHERE sender_uid = ? AND receiver_uid = ? AND read_at IS NULL
    `).run(Date.now(), otherUid, myUid);

    const msgs = db.prepare(`
        SELECT mid, sender_uid, content, created_at
        FROM messages
        WHERE (sender_uid = ? AND receiver_uid = ?)
           OR (sender_uid = ? AND receiver_uid = ?)
        ORDER BY created_at ASC
    `).all(myUid, otherUid, otherUid, myUid);

    res.json(msgs);
});

// 送信
router.post("/:uid", requireAuth, (req, res) => {
    const senderUid   = req.session.uid;
    const receiverUid = req.params.uid;
    const { content } = req.body;

    if (senderUid === receiverUid) return res.status(400).json({ error: "cannot message yourself" });
    if (!content?.trim())          return res.status(400).json({ error: "empty message" });

    const receiver = db.prepare("SELECT uid, dm_setting FROM users WHERE uid = ?").get(receiverUid);
    if (!receiver) return res.status(404).json({ error: "user not found" });

    const sender = db.prepare("SELECT dm_setting FROM users WHERE uid = ?").get(senderUid);
    const needsMutual = (sender?.dm_setting ?? "mutual") === "mutual"
                     || (receiver.dm_setting  ?? "mutual") === "mutual";

    if (needsMutual) {
        const iFollow    = !!db.prepare("SELECT 1 FROM follows WHERE follower_uid = ? AND followee_uid = ?").get(senderUid, receiverUid);
        const theyFollow = !!db.prepare("SELECT 1 FROM follows WHERE follower_uid = ? AND followee_uid = ?").get(receiverUid, senderUid);
        if (!iFollow || !theyFollow) return res.status(403).json({ error: "dm not allowed" });
    }

    const now = Date.now();
    const { lastInsertRowid: mid } = db.prepare(
        "INSERT INTO messages (sender_uid, receiver_uid, content, created_at) VALUES (?, ?, ?, ?)"
    ).run(senderUid, receiverUid, content.trim(), now);

    const msg = { mid: Number(mid), sender_uid: senderUid, content: content.trim(), created_at: now };
    notifyUser(receiverUid, "dm_message", { ...msg, from_uid: senderUid });

    res.status(201).json(msg);
});

export default router;
