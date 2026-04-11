# 確定申告アプリ - デプロイガイド

このドキュメントでは、確定申告アプリを外部ホスティングサービスにデプロイする方法を説明します。

## 必要な環境変数

以下の環境変数を設定する必要があります：

### 必須

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | MySQLデータベースの接続文字列 | `mysql://user:pass@host:3306/dbname` |
| `JWT_SECRET` | JWTトークンの署名に使用する秘密鍵（32文字以上推奨） | `your-super-secret-key-change-in-production` |
| `APP_URL` | アプリケーションの公開URL | `https://your-app.com` |

### メール認証（オプション）

メール認証機能を有効にする場合は、以下の環境変数を設定してください：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `SMTP_HOST` | SMTPサーバーのホスト名 | `smtp.gmail.com` |
| `SMTP_PORT` | SMTPサーバーのポート番号 | `587` |
| `SMTP_USER` | SMTPサーバーのユーザー名 | `your-email@gmail.com` |
| `SMTP_PASS` | SMTPサーバーのパスワード | `your-app-password` |
| `FROM_EMAIL` | 送信元メールアドレス | `noreply@your-app.com` |

### S3ストレージ（必須：7年保存用）

レシート画像の保存にS3を使用する場合：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `S3_BUCKET` | S3バケット名 | `your-bucket-name` |
| `S3_REGION` | S3リージョン | `ap-northeast-1` |
| `S3_ACCESS_KEY_ID` | AWSアクセスキーID | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | `your-secret-key` |
| `S3_ENDPOINT` | S3互換（MinIO等）のエンドポイント（任意） | `https://minio.example.com` |
| `S3_FORCE_PATH_STYLE` | S3互換で必要な場合に `true` | `true` |

### LLM API（レシートスキャン機能）

レシートスキャン機能を使用する場合：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `LLM_API_URL` | LLM APIのエンドポイント | `https://api.openai.com/v1/chat/completions` |
| `LLM_API_KEY` | LLM APIのキー | `sk-...` |
| `LLM_MODEL` | モデル名（任意） | `gpt-4o-mini` |

## デプロイ手順

### 1. Railway

```bash
# Railwayにログイン
railway login

# プロジェクトを作成
railway init

# 環境変数を設定
railway variables set DATABASE_URL="mysql://..."
railway variables set JWT_SECRET="your-secret-key"
railway variables set APP_URL="https://your-app.railway.app"

# デプロイ
railway up
```

### 2. Vercel

```bash
# Vercelにログイン
vercel login

# プロジェクトをデプロイ
vercel

# 環境変数を設定（Vercelダッシュボードから）
# Settings > Environment Variables
```

### 3. Heroku

```bash
# Herokuにログイン
heroku login

# アプリを作成
heroku create your-app-name

# 環境変数を設定
heroku config:set DATABASE_URL="mysql://..."
heroku config:set JWT_SECRET="your-secret-key"
heroku config:set APP_URL="https://your-app-name.herokuapp.com"

# デプロイ
git push heroku main
```

### 4. VPS（Ubuntu）

```bash
# 依存関係をインストール
pnpm install

# ビルド
pnpm build

# 環境変数を設定
export DATABASE_URL="mysql://..."
export JWT_SECRET="your-secret-key"
export APP_URL="https://your-domain.com"

# 起動
pnpm start
```

## データベースのセットアップ

### MySQL/MariaDB

```sql
CREATE DATABASE tax_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tax_app'@'%' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON tax_app.* TO 'tax_app'@'%';
FLUSH PRIVILEGES;
```

### マイグレーション

```bash
# スキーマをプッシュ
pnpm db:push
```

## Gmailでのメール送信設定

Gmailを使用してメール認証を行う場合：

1. Googleアカウントで「2段階認証」を有効にする
2. 「アプリパスワード」を生成する
3. 以下の環境変数を設定：
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your-email@gmail.com`
   - `SMTP_PASS=生成したアプリパスワード`
   - `FROM_EMAIL=your-email@gmail.com`

## セキュリティ注意事項

1. **JWT_SECRET**: 本番環境では必ず強力なランダム文字列を使用してください
2. **HTTPS**: 本番環境では必ずHTTPSを使用してください
3. **データベース**: 本番環境ではSSL接続を有効にしてください
4. **環境変数**: `.env`ファイルをGitにコミットしないでください

## トラブルシューティング

### データベース接続エラー

- `DATABASE_URL`の形式を確認してください
- データベースサーバーが起動しているか確認してください
- ファイアウォールの設定を確認してください

### メール送信エラー

- SMTP設定を確認してください
- Gmailの場合、アプリパスワードを使用しているか確認してください
- ポート587または465を使用しているか確認してください

### ビルドエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules
pnpm install

# キャッシュをクリア
pnpm store prune
```

## サポート

問題が発生した場合は、以下を確認してください：

1. 環境変数が正しく設定されているか
2. データベースに接続できるか
3. ログにエラーメッセージが出ていないか
