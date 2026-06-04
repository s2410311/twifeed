CREATE TABLE follows (
    follower_uid TEXT NOT NULL,
    followee_uid TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    UNIQUE(follower_uid, followee_uid)
);