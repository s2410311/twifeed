CREATE TABLE IF NOT EXISTS users(
    uid TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    exp TEXT,
    department TEXT,
    role TEXT,
    dm_setting TEXT DEFAULT 'mutual',
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
 
CREATE TABLE IF NOT EXISTS follows (
    follower_uid TEXT NOT NULL,
    followee_uid TEXT NOT NULL,
    created_at INTEGER,
    UNIQUE(follower_uid, followee_uid)
);
 
-- カテゴリ
CREATE TABLE IF NOT EXISTS categories (
    cid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER
);
 
-- タグ
CREATE TABLE IF NOT EXISTS tags (
    tid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER
);
 
-- 投稿
CREATE TABLE IF NOT EXISTS articles (
    aid INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    cid INTEGER,
    parent_aid INTEGER,
    root_aid INTEGER,
    content TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at INTEGER
);
 
-- 投稿とタグの中間テーブル
CREATE TABLE IF NOT EXISTS a2t (
    aid INTEGER NOT NULL,
    tid INTEGER NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (aid, tid)
);
 
-- 投稿の添付画像
CREATE TABLE IF NOT EXISTS images (
    iid INTEGER PRIMARY KEY AUTOINCREMENT,
    aid INTEGER,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    thumbnail_url TEXT,
    thumb_width INTEGER,
    thumb_height INTEGER,
    created_at INTEGER
);
 
-- ユーザーのプロフィール画像
CREATE TABLE IF NOT EXISTS user_images (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at INTEGER
);
 
-- いいね
CREATE TABLE IF NOT EXISTS likes (
    uid TEXT NOT NULL,
    aid INTEGER NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (uid, aid)
);
 
-- ダイレクトメッセージ
CREATE TABLE IF NOT EXISTS messages (
    mid INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_uid TEXT NOT NULL,
    receiver_uid TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER,
    read_at INTEGER
);

-- タイムライン（Redisキャッシュ用・RDB側の定義）
CREATE TABLE IF NOT EXISTS timeline (
    uid TEXT NOT NULL,
    aid INTEGER NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (uid, aid)
);
