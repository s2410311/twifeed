import fs from "fs";
import db from "./index.js";

const schema = fs.readFileSync(
    "./db/schema.sql",
    "utf8"
);

db.exec(schema);

console.log("DB initialized");