import express from "express";
import requireAuth from "../middleware/requireAuth.js";
import { addClient, removeClient } from "../lib/sseClients.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const uid = req.session.uid;
    addClient(uid, res);
    req.on("close", () => removeClient(uid, res));
});

export default router;
