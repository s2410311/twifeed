# 構成
* Node.js
* Express
* Redis
* SQLite
* Nginx
* Docker Compose
* HTTPS (mkcert)

---

# 起動方法

必要ツール
* Docker Desktop
* Node.js
* mkcert

# HTTPS証明書作成
mkcert -install
mkdir cert
mkcert -key-file cert/localhost-key.pem -cert-file cert/localhost.pem localhost

# Docker 起動
docker compose up (--build)<-最初かpackage.json更新後のみ
# 停止
docker compose down

---
# 注意
・cert/
秘密鍵を含むため Git 管理しない。
ローカル生成すること。

Git管理対象外
・node_modules/
・cert/
・db/sns.db


