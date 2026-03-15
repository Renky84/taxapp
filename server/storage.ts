import { ENV } from './_core/env';
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = { kind: "forge"; baseUrl: string; apiKey: string } | {
  kind: "s3";
  bucket: string;
  region: string;
  endpoint?: string;
  publicBaseUrl?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getStorageConfig(): StorageConfig | null {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return { kind: "forge", baseUrl: ENV.forgeApiUrl.replace(/\/+$/, ""), apiKey: ENV.forgeApiKey };
  }
  if (process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    return {
      kind: "s3",
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }
  return null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}
function buildAuthHeaders(apiKey: string): HeadersInit { return { Authorization: `Bearer ${apiKey}` }; }
function toFormData(data: Buffer | Uint8Array | string, contentType: string, fileName: string): FormData {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
async function buildForgeDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, { method: "GET", headers: buildAuthHeaders(apiKey) });
  return (await response.json()).url;
}
function getS3Client(config: Extract<StorageConfig, {kind: "s3"}>): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}
function getS3ObjectUrl(config: Extract<StorageConfig, {kind: "s3"}>, key: string) {
  if (config.publicBaseUrl) return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  if (config.endpoint) return `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${key}`;
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export function getStorageMode(): "local" | "remote" {
  return getStorageConfig() ? "remote" : "local";
}

export function getStorageSummary() {
  const config = getStorageConfig();
  if (!config) return { mode: "local", provider: "local", detail: "local_uploads に保存" };
  if (config.kind === "forge") return { mode: "remote", provider: "forge", detail: "Forge Storage API を使用" };
  return { mode: "remote", provider: "s3", detail: `${config.bucket} (${config.region})` };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream"): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  if (!config) {
    const uploadDir = path.join(process.cwd(), "local_uploads", path.dirname(key));
    await fs.mkdir(uploadDir, { recursive: true });
    const targetPath = path.join(process.cwd(), "local_uploads", key);
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await fs.writeFile(targetPath, buffer);
    return { key, url: `/local_uploads/${key}` };
  }
  if (config.kind === "forge") {
    const uploadUrl = buildUploadUrl(config.baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, { method: "POST", headers: buildAuthHeaders(config.apiKey), body: formData });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
    }
    const url = (await response.json()).url;
    return { key, url };
  }
  const client = getS3Client(config);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer, ContentType: contentType }));
  return { key, url: getS3ObjectUrl(config, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  if (!config) return { key, url: `/local_uploads/${key}` };
  if (config.kind === "forge") return { key, url: await buildForgeDownloadUrl(config.baseUrl, key, config.apiKey) };
  if (config.publicBaseUrl) return { key, url: getS3ObjectUrl(config, key) };
  const client = getS3Client(config);
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: 60 });
  return { key, url };
}
