/**
 * Client-side cryptographic & image/input sanitization helpers.
 * Keeps gallery uploads bounded for localStorage & Android native storage sync
 * and validates user-provided rules without exposing sensitive internals.
 */

export function sanitizeUserInput(value: unknown, maxLength = 240): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Safely compresses and resizes an uploaded image File into a bounded JPEG/PNG Data URL
 * suitable for localStorage persistence and Capacitor native sync without QuotaExceeded errors.
 */
export async function compressGalleryImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; preferPng?: boolean } = {}
): Promise<string> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Only image files are supported.");
  }
  const maxWidth = options.maxWidth ?? 1080;
  const maxHeight = options.maxHeight ?? 1920;
  const quality = options.quality ?? 0.86;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode selected image."));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxWidth / Math.max(1, img.width), maxHeight / Math.max(1, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    ctx.drawImage(img, 0, 0, width, height);
    const mime = options.preferPng ? "image/png" : "image/jpeg";
    return canvas.toDataURL(mime, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isValidSafeImageDataUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.startsWith("data:image/jpeg;base64,") ||
    url.startsWith("data:image/png;base64,") ||
    url.startsWith("data:image/webp;base64,") ||
    url.startsWith("/assets/")
  );
}
