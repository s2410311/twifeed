CREATE TABLE IF NOT EXISTS users(
    uid TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    exp TEXT,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS passkeys(
    pid INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    credential_id BLOB UNIQUE,
    public_key BLOB,
    sign_count INTEGER NOT NULL,
    transports TEXT,
    backup_eligible INTEGER,
    created_at INTEGER,
    last_used_at INTEGER
);

CREATE TABLE follows (
    follower_uid TEXT NOT NULL,
    followee_uid TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    UNIQUE(follower_uid, followee_uid)
);
