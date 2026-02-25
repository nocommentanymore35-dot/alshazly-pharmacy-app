// Cloudinary storage for persistent image hosting
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "djambipwp",
  api_key: process.env.CLOUDINARY_API_KEY || "777756389123773",
  api_secret: process.env.CLOUDINARY_API_SECRET || "j0RKVCY6Nyh1KqlYagLbf2FxK_M",
});

function normalizeKey(relKey: string): string {
  // Remove leading slashes, file extension, and sanitize
  return relKey
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .replace(/\.[^/.]+$/, "") // Remove file extension for Cloudinary public_id
    .replace(/[^a-zA-Z0-9_\-\/]/g, "_"); // Sanitize special characters
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const publicId = normalizeKey(relKey);

  // Convert data to base64 data URI for Cloudinary upload
  const buffer =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const base64Data = buffer.toString("base64");

  // Determine the mime type
  let mimeType = contentType;
  if (
    mimeType === "application/octet-stream" &&
    relKey.match(/\.(jpg|jpeg)$/i)
  ) {
    mimeType = "image/jpeg";
  } else if (
    mimeType === "application/octet-stream" &&
    relKey.match(/\.png$/i)
  ) {
    mimeType = "image/png";
  } else if (
    mimeType === "application/octet-stream" &&
    relKey.match(/\.webp$/i)
  ) {
    mimeType = "image/webp";
  } else if (
    mimeType === "application/octet-stream" &&
    relKey.match(/\.gif$/i)
  ) {
    mimeType = "image/gif";
  }

  const dataUri = `data:${mimeType};base64,${base64Data}`;

  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      folder: "alshazly-pharmacy",
      overwrite: true,
      resource_type: "image",
    });

    console.log(`[Cloudinary] Uploaded: ${result.secure_url}`);
    return { key: publicId, url: result.secure_url };
  } catch (error) {
    console.error("[Cloudinary] Upload error:", error);
    throw new Error(`Failed to upload image to Cloudinary: ${error}`);
  }
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const publicId = normalizeKey(relKey);

  try {
    // Generate the Cloudinary URL
    const url = cloudinary.url(`alshazly-pharmacy/${publicId}`, {
      secure: true,
      fetch_format: "auto",
      quality: "auto",
    });

    return { key: publicId, url };
  } catch (error) {
    console.error("[Cloudinary] Get URL error:", error);
    return { key: publicId, url: "" };
  }
}
