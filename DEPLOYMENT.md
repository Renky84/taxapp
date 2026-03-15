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

### S3ストレージ（オプション）

レシート画像の保存にS3を使用する場合：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `S3_BUCKET` | S3バケット名 | `your-bucket-name` |
| `S3_REGION` | S3リージョン | `ap-northeast-1` |
| `S3_ACCESS_KEY` | AWSアクセスキー | `AKIA...` |
| `S3_SECRET_KEY` | AWSシークレットキー | `your-secret-key` |

### LLM API（レシートスキャン機能）

レシートスキャン機能を使用する場合：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `LLM_API_URL` | LLM APIのエンドポイント | `https://api.openai.com/v1` |
| `LLM_API_KEY` | LLM APIのキー | `sk-...` |

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


## 2026-03 Phase 1 foundation

- Added email-based 2-factor authentication flow for login.
- Added an in-app AI assistant page (`/assistant`) backed by tRPC.
- Added local upload fallback so receipt development can continue even before storage credentials are ready.
- Added `.env.example` with the variables required to move to production.

### Next recommended steps
1. Move storage from local fallback to Supabase Storage or S3.
2. Replace email 2FA with TOTP if you want authenticator-app based login.
3. Add journal-entry tables for double-entry bookkeeping and year-end closing flows.
4. Wire OCR/vision extraction results into `receiptDetails` and `receiptLineItems`.

## Phase 2: 仕訳帳の土台
- `drizzle/0006_journal_foundation.sql` を追加し、仕訳ヘッダー/明細テーブルを作成
- `/ledger` ページを追加し、手動仕訳、月次補完、科目別集計を実装
- 売上登録・経費登録時に自動で仕訳も作成するように変更
- レポート画面に仕訳件数、要確認件数、仕訳サマリーを追加


## Phase 3: レシート確認キュー
- AIで読み取ったレシートを `receiptDetails` / `receiptLineItems` に保存
- `ReviewExtracted` 画面で、カテゴリ・金額・摘要・日付を調整して承認可能
- 承認すると経費登録と仕訳作成まで自動で実行
- 却下したレシートは要確認キューから除外


## Phase 5: 請求書PDF取込
- `drizzle/0007_invoice_pdf_support.sql` を適用してください。
- `receipts` テーブルに `mimeType` と `documentType` を追加します。
- `application/pdf` の取込は、公開URLを返せるストレージ設定が必要です。ローカル保存フォールバックではPDF解析を実行しません。
- 追加ページ: `/invoice-import`


## Phase 7: 申告チェックと帳簿参照AI
- `/filing-check` を追加し、年次集計と申告前チェックを確認できるようにしました。
- AI相談で、今月の売上・経費・要確認件数を文脈に含めて回答できるようにしました。
- 申告前チェックは、事業プロフィール、申告期限、要確認キュー、未確定仕訳、証憑未登録の経費、入力ゼロの月を確認します。


## Phase 8: 月次締め
- `drizzle/0008_monthly_close.sql` を適用してください。
- 月次締めは、AI未承認・未確定仕訳・証憑未登録の経費が残っていると実行できません。
- 締めメモは `monthClosings.notes` に保存されます。


## Phase 9: 年次CSVと申告チェック出力
- 帳簿生成ページから、年次帳簿CSV / 年次仕訳帳CSV / 年次総勘定元帳CSV / 申告チェックCSV を出力できるようにしました。
- 申告チェックCSVには、年次サマリー・チェック項目・月次締め状況をまとめています。
- 実運用前に、ダウンロードしたCSVが利用中の表計算ソフトで文字化けしないか確認してください。


## Phase 10: 最終確認画面
- `/final-review` を追加
- 申告直前の重要指標を一覧化
- 月次締め率、証憑保存率、重複候補を表示
- 最終確認CSVの出力を追加


## Phase 11: 申告準備パック
- `/submission-pack` を追加
- 年次帳簿CSV、年次仕訳帳CSV、年次総勘定元帳CSV、申告チェックCSV、最終確認CSV を一か所からまとめて出力できるようにしました
- 提出前の不足項目と優先アクションを集約し、プロフィール未設定や未締め月が残っている場合も気づけるようにしました


## Phase 12: 運用準備と重複候補の見える化
- `/operations-setup` を追加し、DB / APP_URL / JWT / SMTP / AI / ストレージの設定漏れを画面で確認できるようにしました。
- ストレージがローカル保存フォールバック中か、リモート保存に切り替わっているかを表示します。
- 要確認キューで、同日・同額・摘要近似の経費を重複候補として表示するようにしました。
- 本番公開前に `.env.example` とこのページを見比べて、未設定項目を埋めてください。


## Phase 14: 公開前チェックリスト
- `/go-live-checklist` を追加
- 本番用の環境変数をグループ別に確認できるようにしました
- `drizzle` 配下の SQL 一覧をそのまま確認できます
- 実行コマンド（`pnpm install` / `pnpm db:push` / `pnpm build` / `pnpm start`）を画面からそのまま確認できます
- `.env.production.example` を追加し、本番用のひな形を分けました

### 本番公開の最短手順
1. `.env.production.example` を `.env.production` に複製して値を埋める
2. 本番DB接続を確認して `pnpm db:push` を実行する
3. ストレージが `local` のままなら `S3_*` を設定して `remote` に切り替える
4. 管理者でログインし、プロフィール画面から TOTP を有効化する
5. レシート画像と請求書PDFを1件ずつ読み取り、要確認から承認まで通す
6. 申告準備パックからCSV一式をまとめて出力できることを確認する


## Phase 15: 起動診断
- `/deployment-diagnostics` を追加
- 本番公開前のブロッカー / 注意項目 / スモークテストを可視化
- `TWO_FACTOR_PENDING_SECRET`、`JWT_SECRET`、`APP_URL`、SMTP、リモートストレージ、OpenAI の診断を追加
- 提出フローの前に、起動不能になりやすい設定漏れを拾いやすくした


## Phase 16
- 環境変数参照を `server/_core/env.ts` の `ENV` へ寄せ、JWT/TOTP/SMTP/OpenAI の診断を一元化しました。
- `TOTP_SETUP_SECRET` を専用シークレットとして扱うようにし、診断でも必須表示に変更しました。
- `shared/journal.ts` のカテゴリコードに `transportation` などの別名を追加し、交通費が雑費へ落ちるケースを抑えました。
- `ReceiptScan` でカテゴリ未設定時のフォールバックを追加しました。
