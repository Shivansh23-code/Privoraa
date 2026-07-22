export const MAX_ATTACHMENTS = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const SOURCE_EXTENSIONS = new Set(['txt', 'md', 'log', 'java', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'yaml', 'yml',
  'sql', 'py', 'cpp', 'c', 'cs', 'html', 'css', 'pdf', 'docx', 'csv']);

export function attachmentKind(file) {
  const extension = file?.name?.split('.').pop()?.toLowerCase() || '';
  if (file?.type?.startsWith('image/') && IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (SOURCE_EXTENSIONS.has(extension)) return 'source';
  return 'unsupported';
}

export function validateAttachment(file) {
  const kind = attachmentKind(file);
  if (kind === 'unsupported') return 'Unsupported file type.';
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (!file.size) return 'File is empty.';
  if (file.size > limit) return `${kind === 'image' ? 'Image' : 'File'} is too large.`;
  if (kind === 'source') {
    const mime = file.type?.toLowerCase() || '';
    const validMime = !mime || mime.startsWith('text/') || mime === 'application/octet-stream'
      || mime === 'application/pdf' || mime === 'application/json' || mime.includes('xml')
      || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!validMime) return 'File content type is not supported.';
  }
  return null;
}

export function createLongPasteFile(text) {
  return new File([text], 'pasted-text.txt', { type: 'text/plain' });
}
