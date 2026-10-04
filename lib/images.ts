// Food-photo helpers (pure, no framework imports). See docs/plans/feat-2-food-photos.md.

export const FOOD_IMAGE_BUCKET = "food-images";
export const MAX_IMAGE_BYTES = 800 * 1024; // after the browser's resize a photo is typically 100–300 KB
export const MAX_IMAGE_SIDE = 1200; // longest side in pixels after the browser's resize

export type ImageError = "imageType" | "imageTooLarge" | "imageInvalid";

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// Server-side check of an uploaded photo: JPEG only (the browser converts everything to JPEG), small, and really a JPEG.
export function validateImageUpload(file: { size: number; type: string }, bytes: Uint8Array): ImageError | null {
  if (file.type !== "image/jpeg") return "imageType";
  if (file.size > MAX_IMAGE_BYTES || bytes.length > MAX_IMAGE_BYTES) return "imageTooLarge";
  if (file.size === 0 || !isJpeg(bytes)) return "imageInvalid";
  return null;
}

// Removes every metadata segment from a JPEG: EXIF/GPS and XMP (APP1), IPTC/Photoshop (APP13), all other APPn
// after JFIF (APP0), and comments. The compressed image data is copied byte for byte. Privacy: phone photos
// carry the GPS position where they were taken — for a home kitchen that is the merchant's home address.
// The browser re-encode already drops it; this is the server-side guarantee against a tampered request.
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const invalid = () => new Error("Invalid JPEG");
  if (!isJpeg(bytes)) throw invalid();
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  const n = bytes.length;
  let i = 2;

  while (i < n) {
    if (bytes[i] !== 0xff) throw invalid();
    if (i + 1 >= n) throw invalid();
    const marker = bytes[i + 1];
    if (marker === 0xff) { // padding byte before a marker
      i += 1;
      continue;
    }
    if (marker === 0xd9) { // EOI
      chunks.push(bytes.subarray(i, i + 2));
      i += 2;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { // markers without a length
      chunks.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > n) throw invalid();
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > n) throw invalid();
    if (marker === 0xda) { // start of scan: the rest is entropy-coded data; copy it untouched
      chunks.push(bytes.subarray(i, n));
      i = n;
      break;
    }
    const end = i + 2 + length;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) chunks.push(bytes.subarray(i, end));
    i = end;
  }

  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// <merchant_id>/<food_id>-<random>.jpg — the first folder is what the storage policy checks.
export function foodImagePath(merchantId: string, foodId: string, random: string): string {
  return `${merchantId}/${foodId}-${random}.jpg`;
}

// Public URL for a stored photo (the bucket is public-read), or null when there is no photo.
export function foodImageUrl(supabaseUrl: string | undefined, path: string | null | undefined): string | null {
  if (!supabaseUrl || !path) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${FOOD_IMAGE_BUCKET}/${path}`;
}

// Target size for the browser-side resize: the longest side is at most `max` px; never upscales.
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
