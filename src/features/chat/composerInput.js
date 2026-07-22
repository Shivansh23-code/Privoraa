export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file) {
  if (!file || !IMAGE_TYPES.has(file.type)) return 'Use a PNG, JPEG, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 10 MB.';
  return null;
}

export function clipboardImages(clipboardData) {
  return Array.from(clipboardData?.items || [])
    .filter((item) => item.type?.startsWith('image/'))
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
}

export function clipboardFiles(clipboardData) {
  return Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === 'file' || item.type?.startsWith('image/'))
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
}

export function shouldSubmitFromKey(event) {
  if (event?.nativeEvent?.isComposing || event?.isComposing) return false;
  return event?.key === 'Enter' && !event.shiftKey;
}
