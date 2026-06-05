import db from "../db/index.js";
import { extractTags } from "../utils/extractTags.js";
import { pushToTimeline } from "../lib/timelineStore.js";

const insertArticleWithTags = db.transaction((uid, cid, parent_aid, root_aid, content) => {
    const { lastInsertRowid: aid } = db.prepare(`
        INSERT INTO articles (uid, cid, parent_aid, root_aid, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, cid, parent_aid, root_aid, content, Date.now());

    const tagNames = extractTags(content);
    const now = Date.now();

    for (const name of tagNames) {
        db.prepare(
            "INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)"
        ).run(name, now);

        const { tid } = db.prepare(
            "SELECT tid FROM tags WHERE name = ?"
        ).get(name);

        db.prepare(
            "INSERT OR IGNORE INTO a2t (aid, tid, created_at) VALUES (?, ?, ?)"
        ).run(aid, tid, now);
    }

    return aid;
});

export async function createArticle(uid, { content, cid = null, parent_aid = null, image_ids = [] }) {
    if (!content || typeof content !== "string" || content.trim() === "") {
        return { error: "content is required", status: 400 };
    }
    if (content.length > 1000) {
        return { error: "content too long", status: 400 };
    }
    if (!Array.isArray(image_ids) || image_ids.length > 4) {
        return { error: "image_ids must be an array of up to 4", status: 400 };
    }

    let root_aid = null;
    if (parent_aid != null) {
        const parent = db.prepare("SELECT aid, root_aid FROM articles WHERE aid = ?").get(parent_aid);
        if (!parent) return { error: "parent article not found", status: 404 };
        root_aid = parent.root_aid ?? parent.aid;
    }

    const aid = insertArticleWithTags(uid, cid, parent_aid, root_aid, content.trim());

    if (image_ids.length > 0) {
        const placeholders = image_ids.map(() => "?").join(",");
        db.prepare(
            `UPDATE images SET aid = ? WHERE iid IN (${placeholders}) AND aid IS NULL`
        ).run(aid, ...image_ids);
    }

    const followers = db.prepare(
        "SELECT follower_uid FROM follows WHERE followee_uid = ?"
    ).all(uid);

    await Promise.all([
        pushToTimeline(uid, aid),
        ...followers.map(f => pushToTimeline(f.follower_uid, aid))
    ]);

    return { aid };
}
