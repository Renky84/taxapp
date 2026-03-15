const devDefault = (value: string, fallback: string) =>
  value || (process.env.NODE_ENV === "production" ? "" : fallback);

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  appName: process.env.APP_NAME ?? "確定申告アプリ",
  appUrl: process.env.APP_URL ?? "",
  cookieSecret: devDefault(process.env.JWT_SECRET ?? "", "dev-jwt-secret-change-me"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  twoFactorPendingSecret: devDefault(process.env.TWO_FACTOR_PENDING_SECRET ?? "", "dev-2fa-pending-secret-change-me"),
  totpSetupSecret: devDefault(process.env.TOTP_SETUP_SECRET ?? "", "dev-totp-setup-secret-change-me"),
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? "587"),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    fromEmail: process.env.FROM_EMAIL ?? "noreply@example.com",
  },
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
};
