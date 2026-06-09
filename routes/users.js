import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import redis from "../lib/redisClient.js";
import { regenerateAuthenticatedSession } from "../service/sessionAuth.js";
import { expToLevel, levelToExp } from "../utils/level.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
    const uid = req.session.uid;
    const user = db.prepare(
        "SELECT uid, name, email, COALESCE(CAST(exp AS INTEGER), 0) AS exp FROM users WHERE uid = ?"
    ).get(uid);

    if (!user) return res.status(404).json({ error: "user not found" });

    const delta = parseInt(await redis.get(`exp:${uid}`)) || 0;
    const totalExp = Math.max(user.exp + delta, 0);

    const level = expToLevel(totalExp);
    const expForNext = levelToExp(level + 1);

    res.json({
        uid: user.uid,
        name: user.name,
        email: user.email,
        level,
        exp: totalExp,
        exp_to_next: expForNext - totalExp,
    });
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
    const { uid: newUid, name, email } = req.body;
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

    const fields = [];
    const values = [];
    if (name !== undefined)  { fields.push("name = ?");  values.push(name.trim()); }
    if (email !== undefined) { fields.push("email = ?"); values.push(email.trim()); }

    if (fields.length > 0) {
        values.push(currentUid);
        db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE uid = ?`).run(...values);
    }

    res.json({ ok: true });
});

export default router;
