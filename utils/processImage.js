import sharp from "sharp";
import { randomUUID } from "crypto";
import fs from "fs/promises";

const UPLOAD_DIR = "./public/uploads";
const THUMB_MAX = 600; // サムネイルの最大辺（px）
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedType(mimetype) {
    return ALLOWED_TYPES.has(mimetype);
}

export async function processAvatar(buffer, mimetype) {
    const ext = mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "jpg";
    await fs.mkdir(`${UPLOAD_DIR}/icons`, { recursive: true });
    const name = randomUUID();
    const filePath = `${UPLOAD_DIR}/icons/${name}.${ext}`;
    await sharp(buffer)
        .resize(200, 200, { fit: "cover", position: "centre" })
        .toFile(filePath);
    return { url: `/uploads/icons/${name}.${ext}` };
}

export async function processImage(buffer, mimetype) {
    const ext = mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "jpg";
    const name = randomUUID();

    await fs.mkdir(`${UPLOAD_DIR}/original`, { recursive: true });
    await fs.mkdir(`${UPLOAD_DIR}/thumb`, { recursive: true });

    const originalPath = `${UPLOAD_DIR}/original/${name}.${ext}`;
    const thumbPath = `${UPLOAD_DIR}/thumb/${name}.${ext}`;

    const image = sharp(buffer);
    const { width, height } = await image.metadata();

    await image.toFile(originalPath);

    await sharp(buffer)
        .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
        .toFile(thumbPath);

    const thumb = await sharp(thumbPath).metadata();

    return {
        url: `/uploads/original/${name}.${ext}`,
        width,
        height,
        thumbnail_url: `/uploads/thumb/${name}.${ext}`,
        thumb_width: thumb.width,
        thumb_height: thumb.height,
    };
}
