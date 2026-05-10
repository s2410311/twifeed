import express from "express";

import {
    destroySession
} from "../lib/sessionStore.js";

import {
    clearSessionCookie
} from "../lib/cookie.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        await destroySession(
            req.session.sid
        );

        res.setHeader(
            "Set-Cookie",
            clearSessionCookie()
        );

        res.json({
            ok: true
        });

    } catch (e) {

        console.error(e);

        res.status(500).json({
            error: "logout failed"
        });
    }
});

export default router;