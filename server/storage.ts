// Local file storage for standalone deployment
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\./g, "");
}

// Get the base URL for uploaded files
function getBaseUrl(): string {
  // Use RAILWAY_PUBLIC_DOMAIN or fallback to hardcoded production URL
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Fallback to the known production URL
  return process.env.API_BASE_URL || "https://alshazly-pharmacy-app-production.up.railway.app";
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);
  const dirPath = path.dirname(filePath);

  // Create subdirectories if needed
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Write file
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // Return full URL that will be served by express static
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/uploads/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const baseUrl = getBaseUrl();
  return {
    key,
    url: `${baseUrl}/uploads/${key}`,
  };
}
