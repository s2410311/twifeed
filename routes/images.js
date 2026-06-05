import express from "express";
import multer from "multer";
import db from "../db/index.js";
import requireAuth from "../middleware/requireAuth.js";
import { processImage, isAllowedType } from "../utils/processImage.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        if (isAllowedType(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("unsupported image type"));
        }
    },
});

// 最大4枚まで同時アップロード
router.post("/", requireAuth, upload.array("images", 4), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "no images provided" });
    }

    try {
        const results = await Promise.all(
            req.files.map(f => processImage(f.buffer, f.mimetype))
        );

        const now = Date.now();
        const iids = results.map(({ url, width, height, thumbnail_url, thumb_width, thumb_height }) => {
            const { lastInsertRowid } = db.prepare(`
                INSERT INTO images (aid, url, width, height, thumbnail_url, thumb_width, thumb_height, created_at)
                VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
            `).run(url, width, height, thumbnail_url, thumb_width, thumb_height, now);
            return lastInsertRowid;
        });

        res.status(201).json({ iids });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// multerのエラーハンドリング
router.use((err, _req, res, _next) => {
    res.status(400).json({ error: err.message });
});

export default router;
