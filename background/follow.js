const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();

app.use(express.json());
app.use(express.static('../follow_ui'));

// SQLite接続
const db = new sqlite3.Database('./sns.db');
console.log('DB connected');

// followsテーブル作成
db.run(`
  CREATE TABLE IF NOT EXISTS follows (
  follower_uid TEXT NOT NULL,
  followee_uid TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
  `);

app.post('/follow', (req, res) => {

  console.log(req.body);

  const { follower_uid, followee_uid } = req.body;

  // 自分フォロー禁止
  if (follower_uid === followee_uid) {
    res.status(400).send('自分はフォローできません');
    return;
  }

  db.run(
    `
    INSERT INTO follows(follower_uid, followee_uid)
    VALUES (?, ?)
    `,
    [follower_uid, followee_uid],

    (err) => {

      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.send('フォロー完了');
    }
  );
});


// フォロー一覧取得
app.get('/following/:uid', (req, res)=>{
  const uid = req.params.uid;

  db.all(
    `SELECT followee_uid
    FROM follows
    WHERE follower_uid = ?`,
    [uid],
    (err, rows)=>{
      if (err){
        console.log(err);
        res.status(500).send('DB error');
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/followers/:uid', (req, res) => {
  const uid = req.params.uid;

  db.all(
    `
    SELECT follower_uid
    FROM follows
    WHERE followee_uid = ?
    `,
    [uid],
    (err, rows) => {
      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.json(rows);
    }
  );
});

// フォロー済み判定
app.get('/is-following', (req, res) => {
  const { follower_uid, followee_uid } = req.query;

  db.get(
    `
    SELECT 1
    FROM follows
    WHERE follower_uid = ?
    AND followee_uid = ?
    `,
    [follower_uid, followee_uid],
    (err, row) => {
      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.json({ isFollowing: !!row });
    }
  );
});

// フォロー解除
app.delete('/unfollow', (req, res) => {

  const { follower_uid, followee_uid } = req.body;

  db.run(
    `
    DELETE FROM follows
    WHERE follower_uid = ?
    AND followee_uid = ?
    `,
    [follower_uid, followee_uid],

    (err) => {

      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.send('フォロー解除');
    }
  );
});

// フォロー数
app.get('/following-count/:uid', (req, res) => {

  const uid = req.params.uid;

  db.get(
    `
    SELECT COUNT(*) as count
    FROM follows
    WHERE follower_uid = ?
    `,
    [uid],

    (err, row) => {

      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.json(row);
    }
  );
});

// フォロワー数
app.get('/followers-count/:uid', (req, res) => {

  const uid = req.params.uid;

  db.get(
    `
    SELECT COUNT(*) as count
    FROM follows
    WHERE followee_uid = ?
    `,
    [uid],

    (err, row) => {

      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.json(row);
    }
  );
});

// 相互フォロー判定
app.get('/mutual-follow', (req, res) => {

  const { uid1, uid2 } = req.query;

  db.get(
    `
    SELECT 1
    FROM follows f1
    JOIN follows f2
    ON f1.follower_uid = f2.followee_uid
    AND f1.followee_uid = f2.follower_uid
    WHERE f1.follower_uid = ?
    AND f1.followee_uid = ?
    `,
    [uid1, uid2],

    (err, row) => {

      if (err) {
        console.log(err);
        res.status(500).send('DB error');
        return;
      }

      res.json({
        isMutual: !!row
      });
    }
  );
});




app.listen(3000, () => {
  console.log('server start');
});