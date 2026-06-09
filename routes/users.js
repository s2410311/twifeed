import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
    const user = db.prepare(
        "SELECT uid, name, email FROM users WHERE uid = ?"
    ).get(req.session.uid);

    if (!user) return res.status(404).json({ error: "user not found" });

    res.json(user);
});

router.patch("/me", requireAuth, (req, res) => {
    const { name, email } = req.body;

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
        return res.status(400).json({ error: "invalid name" });
    }
    if (email !== undefined && (typeof email !== "string" || email.trim() === "")) {
        return res.status(400).json({ error: "invalid email" });
    }

    const uid = req.session.uid;

    if (email !== undefined) {
        const conflict = db.prepare(
            "SELECT uid FROM users WHERE email = ? AND uid != ?"
        ).get(email.trim(), uid);
        if (conflict) return res.status(409).json({ error: "email already taken" });
    }

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push("name = ?"); values.push(name.trim()); }
    if (email !== undefined) { fields.push("email = ?"); values.push(email.trim()); }

    if (fields.length === 0) return res.status(400).json({ error: "nothing to update" });

    values.push(uid);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE uid = ?`).run(...values);

    res.json({ ok: true });
});

export default router;
