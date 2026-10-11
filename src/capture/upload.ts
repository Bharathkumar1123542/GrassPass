import { EXIF_MAX_AGE_MIN, UPLOAD_MAX_BYTES } from '../config/constants';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateUpload(file: File): { valid: true; file: File } | { valid: false; code: 'INVALID_TYPE' | 'HEIC' | 'TOO_LARGE' | 'EXIF_MISSING' | 'EXIF_STALE'; message: string } {
  const mime = file.type.toLowerCase();
  const lowerName = file.name.toLowerCase();

  if (mime === 'image/heic' || mime === 'image/heif' || lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
    return { valid: false, code: 'HEIC', message: 'HEIC files are not supported. Use the webcam or export as JPEG.' };
  }

  if (!ALLOWED_TYPES.has(mime)) {
    return { valid: false, code: 'INVALID_TYPE', message: 'Only JPEG, PNG, and WebP images are accepted.' };
  }

  if (file.size > UPLOAD_MAX_BYTES) {
    return { valid: false, code: 'TOO_LARGE', message: 'Upload exceeds the 15 MiB size limit.' };
  }

  return { valid: true, file };
}

export async function extractExifDate(file: File): Promise<Date | null> {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  const matches = text.match(/DateTimeOriginal[:= ]\s*(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/i);

  if (!matches || matches.length < 2) {
    return null;
  }

  const value = matches[1];
  const parsed = new Date(value.replace(' ', 'T').replace(/:/g, '-'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function isExifFresh(file: File, now: number = Date.now()): Promise<{ valid: true } | { valid: false; code: 'EXIF_MISSING' | 'EXIF_STALE'; message: string }> {
  return validateExif(file, now);
}

export async function validateExif(file: File, now: number = Date.now()): Promise<{ valid: true } | { valid: false; code: 'EXIF_MISSING' | 'EXIF_STALE'; message: string }> {
  const extracted = await extractExifDate(file);

  if (!extracted) {
    return { valid: false, code: 'EXIF_MISSING', message: 'Use the webcam, or upload a photo taken in the last 20 minutes.' };
  }

  const ageMinutes = (now - extracted.getTime()) / 60_000;
  if (ageMinutes > EXIF_MAX_AGE_MIN) {
    return { valid: false, code: 'EXIF_STALE', message: 'Use the webcam, or upload a photo taken in the last 20 minutes.' };
  }

  return { valid: true };
}
