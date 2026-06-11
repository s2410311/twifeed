import express from "express";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
    const categories = db.prepare("SELECT cid, name FROM categories ORDER BY cid ASC").all();
    res.json({ categories });
});

export default router;
