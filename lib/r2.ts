import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 S3 Client configuration
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || "",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "";

/**
 * Generate a pre-signed URL to upload a file directly from the browser to Cloudflare R2
 * This keeps the web server fast and reduces bandwidth costs.
 * 
 * @param key The unique path/filename under the bucket (e.g. listings/user-123/image-abc.jpg)
 * @param contentType The file mime type (e.g. image/jpeg)
 * @param expiresInSeconds Duration the upload link is valid (defaults to 10 mins)
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file directly from Cloudflare R2
 * 
 * @param key The path/filename of the object to delete
 */
export async function deleteFileFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Convert a key back into a public CDN URL
 * If Cloudflare R2 custom domain or public URL path is configured.
 */
export function getR2PublicUrl(key: string): string {
  const publicDomain = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || "";
  if (!publicDomain) return "";
  // Ensure trailing slash logic
  const domain = publicDomain.endsWith("/") ? publicDomain : `${publicDomain}/`;
  return `${domain}${key}`;
}
