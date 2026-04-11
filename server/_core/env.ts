export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // LLM (optional): for receipt auto-extraction. If not set, scan features will fail gracefully.
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",

  // Object storage (required): store receipts and exports for long-term retention.
  s3Region: process.env.S3_REGION ?? "ap-northeast-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "", // optional (S3 compatible like MinIO)
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};
