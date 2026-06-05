# twifeed

## 構成

| 技術 | 用途 |
|------|------|
| Node.js / Express | APIサーバー |
| SQLite (better-sqlite3) | データベース |
| Redis | セッション・タイムライン・閲覧数キャッシュ |
| Nginx | リバースプロキシ / HTTPS終端 |
| Docker Compose | コンテナ管理 |
| WebAuthn (SimpleWebAuthn) | パスキー認証 |

---

## 起動方法

### 必要なもの

- Docker Desktop
- Node.js
- mkcert（ローカルHTTPS用）

### ローカル開発環境

```bash
# HTTPS証明書を生成（初回のみ）
mkcert -install
mkdir cert
mkcert -key-file cert/localhost-key.pem -cert-file cert/localhost.pem localhost

# 起動（docker-compose.override.yml が自動適用される）
docker compose up --build   # 初回 or package.json 変更後
docker compose up           # 2回目以降

# 停止
docker compose down
```

### 本番環境

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

本番は `/etc/letsencrypt` の Let's Encrypt 証明書を使用。

---

## Git管理対象外

```
node_modules/
cert/           # 秘密鍵を含むため。ローカルで mkcert により生成すること
db/sns.db
```

---

## APIエンドポイント一覧

`*` は要認証（セッション必須）

### 認証 `/auth`

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/auth/options` | WebAuthn認証オプション取得 |
| POST | `/auth/verify` | WebAuthn認証検証 |

### ユーザー登録 `/register`

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/register/options` | WebAuthn登録オプション取得 |
| POST | `/register/verify` | WebAuthn登録検証・ユーザー作成 |

### ログアウト `/logout`

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/logout` | ログアウト |

### 投稿 `/articles`

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/articles` * | 投稿作成 |
| GET | `/articles/:aid` | 記事詳細（閲覧数カウント） |
| GET | `/articles/:aid/replies` | 返信一覧（`?offset=&limit=`） |
| POST | `/articles/:aid/replies` * | 返信投稿 |
| POST | `/articles/:aid/likes` * | いいね |
| DELETE | `/articles/:aid/likes` * | いいね解除 |
| POST | `/articles/flush-views` | 閲覧数をRedis→DBにフラッシュ |


### タイムライン `/timeline`

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/timeline` * | タイムライン取得（`?offset=&limit=`） |

### 画像 `/images`

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/images` * | 画像アップロード（最大4枚、最大10MB/枚） |
