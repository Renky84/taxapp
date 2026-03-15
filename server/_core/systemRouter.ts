import fs from "fs";
import path from "path";
import { z } from "zod";
import { notifyOwner } from "./notification";
import { getStorageMode, getStorageSummary } from "../storage";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";



function getMigrationFiles() {
  try {
    const drizzleDir = path.resolve(process.cwd(), "drizzle");
    return fs.readdirSync(drizzleDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

function maskExample(value: string, visible = 4) {
  if (!value) return "未設定";
  if (value.length <= visible) return value;
  return `${value.slice(0, visible)}...`;
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),



  getReadiness: publicProcedure
    .query(() => {
      const hasDatabase = Boolean(ENV.databaseUrl);
      const hasJwtSecret = Boolean(ENV.cookieSecret);
      const hasAppUrl = Boolean(ENV.appUrl);
      const hasOpenAi = Boolean(ENV.openAiApiKey);
      const hasSmtp = Boolean(ENV.smtp.host && ENV.smtp.port && ENV.smtp.user && ENV.smtp.pass && ENV.smtp.fromEmail);
      const storageMode = getStorageMode();
      const storageSummary = getStorageSummary();
      const hasTotpSupport = Boolean(ENV.totpSetupSecret);
      const checks = [
        {
          key: 'database',
          label: 'データベース',
          status: hasDatabase ? 'ready' : 'attention',
          detail: hasDatabase ? 'DATABASE_URL が設定されています。' : 'DATABASE_URL が未設定です。帳簿保存ができません。',
        },
        {
          key: 'auth',
          label: 'ログイン / 2段階認証',
          status: hasJwtSecret && hasAppUrl ? 'ready' : 'attention',
          detail: hasJwtSecret && hasAppUrl ? 'JWT_SECRET と APP_URL を確認できました。' : 'JWT_SECRET または APP_URL が不足しています。',
        },
        {
          key: 'smtp',
          label: 'メール送信',
          status: hasSmtp ? 'ready' : 'attention',
          detail: hasSmtp ? 'SMTP 設定があります。メールコード認証を運用できます。' : 'SMTP 設定が不足しています。メール2段階認証が送信できません。',
        },
        {
          key: 'totp',
          label: '認証アプリ2段階認証',
          status: hasTotpSupport ? 'ready' : 'attention',
          detail: hasTotpSupport ? 'TOTP化に必要な署名用シークレットを確認できました。' : 'JWT_SECRET などの署名用シークレットが不足しています。',
        },
        {
          key: 'storage',
          label: '書類ストレージ',
          status: storageMode === 'remote' ? 'ready' : 'attention',
          detail: storageMode === 'remote' ? 'リモートストレージが有効です。PDF解析も進めやすい状態です。' : 'ローカル保存フォールバック中です。本番ではリモートストレージを推奨します。',
        },
        {
          key: 'ai',
          label: 'AI読取 / AI相談',
          status: hasOpenAi ? 'ready' : 'attention',
          detail: hasOpenAi ? 'OPENAI_API_KEY を確認できました。' : 'OPENAI_API_KEY が未設定です。AI読取とAI相談が使えません。',
        },
      ];

      return {
        appUrl: ENV.appUrl || '',
        storageMode,
        storageProvider: storageSummary.provider,
        checks,
        readyCount: checks.filter((item) => item.status === 'ready').length,
        attentionCount: checks.filter((item) => item.status !== 'ready').length,
        recommendedActions: checks.filter((item) => item.status !== 'ready').map((item) => item.label),
      };
    }),

  getGoLiveChecklist: publicProcedure
    .query(() => {
      const migrationFiles = getMigrationFiles();
      const storageMode = getStorageMode();
      const storageSummary = getStorageSummary();
      const envGroups = [
        {
          label: 'アプリ基盤',
          items: [
            { key: 'DATABASE_URL', required: true, configured: Boolean(process.env.DATABASE_URL), example: 'mysql://USER:PASSWORD@HOST:3306/DB_NAME' },
            { key: 'JWT_SECRET', required: true, configured: Boolean(ENV.cookieSecret), example: maskExample(ENV.cookieSecret || '') },
            { key: 'APP_URL', required: true, configured: Boolean(ENV.appUrl), example: ENV.appUrl || 'https://your-app.example.com' },
            { key: 'TWO_FACTOR_PENDING_SECRET', required: true, configured: Boolean(ENV.twoFactorPendingSecret), example: maskExample(ENV.twoFactorPendingSecret || '') },
            { key: 'TOTP_SETUP_SECRET', required: true, configured: Boolean(ENV.totpSetupSecret), example: maskExample(ENV.totpSetupSecret || '') },
          ],
        },
        {
          label: 'メール送信',
          items: [
            { key: 'SMTP_HOST', required: true, configured: Boolean(ENV.smtp.host), example: ENV.smtp.host || 'smtp.gmail.com' },
            { key: 'SMTP_PORT', required: true, configured: Boolean(ENV.smtp.port), example: String(ENV.smtp.port || '587') },
            { key: 'SMTP_USER', required: true, configured: Boolean(ENV.smtp.user), example: ENV.smtp.user || 'your-account@example.com' },
            { key: 'SMTP_PASS', required: true, configured: Boolean(ENV.smtp.pass), example: ENV.smtp.pass ? maskExample(ENV.smtp.pass) : 'app-password' },
            { key: 'FROM_EMAIL', required: true, configured: Boolean(ENV.smtp.fromEmail), example: ENV.smtp.fromEmail || 'noreply@example.com' },
          ],
        },
        {
          label: 'AI / 読取',
          items: [
            { key: 'OPENAI_API_KEY', required: true, configured: Boolean(ENV.openAiApiKey), example: ENV.openAiApiKey ? maskExample(ENV.openAiApiKey) : 'sk-...' },
            { key: 'OPENAI_MODEL', required: false, configured: Boolean(ENV.openAiModel), example: ENV.openAiModel || 'gpt-4.1-mini' },
          ],
        },
        {
          label: 'リモートストレージ',
          items: [
            { key: 'S3_BUCKET', required: storageMode === 'remote', configured: Boolean(process.env.S3_BUCKET), example: process.env.S3_BUCKET || 'your-bucket-name' },
            { key: 'S3_REGION', required: storageMode === 'remote', configured: Boolean(process.env.S3_REGION), example: process.env.S3_REGION || 'ap-northeast-1' },
            { key: 'S3_ACCESS_KEY', required: storageMode === 'remote', configured: Boolean(process.env.S3_ACCESS_KEY), example: process.env.S3_ACCESS_KEY ? maskExample(process.env.S3_ACCESS_KEY) : 'AKIA...' },
            { key: 'S3_SECRET_KEY', required: storageMode === 'remote', configured: Boolean(process.env.S3_SECRET_KEY), example: process.env.S3_SECRET_KEY ? maskExample(process.env.S3_SECRET_KEY) : 'secret' },
            { key: 'S3_ENDPOINT', required: false, configured: Boolean(process.env.S3_ENDPOINT), example: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com' },
            { key: 'S3_PUBLIC_BASE_URL', required: false, configured: Boolean(process.env.S3_PUBLIC_BASE_URL), example: process.env.S3_PUBLIC_BASE_URL || 'https://cdn.example.com' },
          ],
        },
      ];

      const criticalPending = envGroups
        .flatMap((group) => group.items)
        .filter((item) => item.required && !item.configured)
        .map((item) => item.key);

      const steps = [
        '1. .env.production を作成し、必須環境変数を埋める',
        '2. 本番DBへ接続できる状態で pnpm db:push を実行する',
        '3. ストレージを local ではなく remote に切り替える',
        '4. 管理者アカウントでログインし、TOTP を有効化する',
        '5. サンプルのレシート画像と請求書PDFを1件ずつ読み込む',
        '6. 申告準備パックからCSV一式を出力できることを確認する',
      ];

      return {
        storageMode,
        storageProvider: storageSummary.provider,
        migrationFiles,
        envGroups,
        criticalPending,
        commands: {
          install: 'pnpm install',
          migrate: 'pnpm db:push',
          build: 'pnpm build',
          start: 'pnpm start',
        },
        steps,
      };
    }),



  getDeploymentDiagnostics: publicProcedure
    .query(() => {
      const storageMode = getStorageMode();
      const storageSummary = getStorageSummary();
      const hasDatabase = Boolean(ENV.databaseUrl);
      const hasJwtSecret = Boolean(ENV.cookieSecret);
      const hasAppUrl = Boolean(ENV.appUrl);
      const hasPendingSecret = Boolean(ENV.twoFactorPendingSecret);
      const hasTotpSecret = Boolean(ENV.totpSetupSecret);
      const hasSmtp = Boolean(ENV.smtp.host && ENV.smtp.port && ENV.smtp.user && ENV.smtp.pass && ENV.smtp.fromEmail);
      const hasOpenAi = Boolean(ENV.openAiApiKey);
      const remoteStorageConfigured = storageMode === 'remote' && Boolean(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

      const checks = [
        {
          key: 'database',
          label: 'データベース接続',
          status: hasDatabase ? 'pass' : 'fail',
          detail: hasDatabase ? 'DATABASE_URL を確認できました。' : 'DATABASE_URL が未設定です。',
        },
        {
          key: 'session',
          label: 'ログインセッション署名',
          status: hasJwtSecret ? 'pass' : 'fail',
          detail: hasJwtSecret ? 'JWT_SECRET を確認できました。' : 'JWT_SECRET が未設定です。',
        },
        {
          key: 'pending-2fa',
          label: '2段階認証の一時トークン',
          status: hasPendingSecret ? 'pass' : 'fail',
          detail: hasPendingSecret ? 'TWO_FACTOR_PENDING_SECRET を確認できました。' : 'TWO_FACTOR_PENDING_SECRET が未設定です。',
        },
        {
          key: 'totp',
          label: 'TOTP 署名設定',
          status: hasTotpSecret ? 'pass' : 'fail',
          detail: hasTotpSecret ? 'TOTP 用の専用シークレットを確認できました。' : 'TOTP_SETUP_SECRET が未設定です。専用シークレットを設定してください。',
        },
        {
          key: 'app-url',
          label: '公開URL',
          status: hasAppUrl ? 'pass' : 'warn',
          detail: hasAppUrl ? `APP_URL: ${process.env.APP_URL}` : 'APP_URL が未設定です。メールリンクや本番判定で不整合が出る可能性があります。',
        },
        {
          key: 'smtp',
          label: 'メール送信',
          status: hasSmtp ? 'pass' : 'warn',
          detail: hasSmtp ? 'SMTP 一式を確認できました。' : 'SMTP が未設定です。メール方式の2段階認証は送信できません。',
        },
        {
          key: 'storage',
          label: '本番ストレージ',
          status: storageMode === 'remote' ? (remoteStorageConfigured ? 'pass' : 'fail') : 'warn',
          detail: storageMode === 'remote' ? (remoteStorageConfigured ? `${storageSummary.provider} でリモート保存します。` : 'remote 指定ですが S3 環境変数が不足しています。') : 'local フォールバックです。本番では remote 推奨です。',
        },
        {
          key: 'ai',
          label: 'AI読取 / AI相談',
          status: hasOpenAi ? 'pass' : 'warn',
          detail: hasOpenAi ? 'OPENAI_API_KEY を確認できました。' : 'OPENAI_API_KEY が未設定です。AI機能は動きません。',
        },
      ];

      const blockers = checks.filter((item) => item.status === 'fail');
      const warnings = checks.filter((item) => item.status === 'warn');
      const smokeTests = [
        { step: '1', label: '管理者でログイン', expected: 'メールまたはTOTPでログイン完了', path: '/login' },
        { step: '2', label: 'プロフィールでTOTP確認', expected: '認証アプリの設定状態が見える', path: '/profile' },
        { step: '3', label: 'レシート画像を1件読む', expected: '要確認キューへ入る', path: '/receipt-scan' },
        { step: '4', label: '請求書PDFを1件読む', expected: '要確認キューへ入る', path: '/invoice-import' },
        { step: '5', label: '要確認で承認', expected: '経費と仕訳が自動作成される', path: '/review-extracted' },
        { step: '6', label: '申告準備パックを出力', expected: 'CSVがまとめてダウンロードできる', path: '/submission-pack' },
      ];

      return {
        checks,
        blockers,
        warnings,
        smokeTests,
        score: checks.filter((item) => item.status === 'pass').length,
        total: checks.length,
        storageMode,
        storageProvider: storageSummary.provider,
        commands: {
          install: 'pnpm install',
          migrate: 'pnpm db:push',
          build: 'pnpm build',
          start: 'pnpm start',
        },
      };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
