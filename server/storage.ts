// Object storage helpers (S3 / S3-compatible)
// - Used for receipts, exports, and any long-term artifacts.
// - Configure with S3_* env vars (see .env.example).

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function assertStorageConfig() {
  if (!ENV.s3Bucket) {
    throw new Error("S3_BUCKET is not configured");
  }
  if (!ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not configured");
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getS3Client(): S3Client {
  assertStorageConfig();
  return new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || undefined,
    forcePathStyle: ENV.s3ForcePathStyle || undefined,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
}

function toBody(data: Buffer | Uint8Array | string): Buffer | Uint8Array {
  if (typeof data === "string") return Buffer.from(data);
  return data;
}

/**
 * Uploads a blob to object storage and returns a short-lived download URL.
 * Note: for 7-year retention, set bucket lifecycle/Object Lock on the storage side.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: toBody(data),
      ContentType: contentType,
    })
  );

  // Provide a signed URL for immediate viewing/download in the UI.
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }),
    { expiresIn: 60 * 60 } // 1 hour
  );

  return { key, url };
}

/**
 * Returns a short-lived download URL.
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }),
    { expiresIn: 60 * 60 }
  );
  return { key, url };
}
