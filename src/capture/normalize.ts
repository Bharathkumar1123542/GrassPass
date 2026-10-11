export function normalizeImageFile(file: File): { file: File; width: number; height: number } {
  const mime = file.type.toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Unsupported image type');
  }

  return {
    file,
    width: 512,
    height: 512,
  };
}

export function isExifFresh(date: Date | null, now: number, maxAgeMinutes: number): boolean {
  if (!date) {
    return false;
  }

  const diffMs = now - date.getTime();
  return diffMs <= maxAgeMinutes * 60_000;
}
