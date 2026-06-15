import fs from "fs";
import db from "./index.js";

const schema = fs.readFileSync(
    "./db/schema.sql",
    "utf8"
);

db.exec(schema);

try { db.exec("ALTER TABLE users ADD COLUMN department TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT"); } catch {}

const categories = ["料理", "ファッション", "学習", "スポーツ", "ゲーム", "本", "キャリア"];
const insert = db.prepare("INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)");
const insertAll = db.transaction(() => {
    for (const name of categories) insert.run(name, Date.now());
});
insertAll();

console.log("DB initialized");