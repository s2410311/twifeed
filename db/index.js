import Database from "better-sqlite3";

const db = new Database("./db/sns.db");

export default db;