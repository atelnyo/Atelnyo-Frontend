/**
 * src/utils/prepareImageUpload.js
 *
 * One shared gate for every image file the user picks, so no surface can
 * send an unbounded or unreadable file:
 *   - non-images are rejected before any network call
 *   - files above MAX_IMAGE_UPLOAD_BYTES are rejected (mirrors the server
 *     cap in creator/services/image_validation.py)
 *   - large-but-acceptable images are downscaled/re-encoded with the
 *     existing Canvas compressor, which keeps uploads fast on mobile
 *
 * Rejections throw an Error whose message is a stable code ('not_image'
 * | 'too_large') so callers can localize their own copy.
 */
import { compressImage } from './imageCompression';

/** Hard client limit — matches the backend's 8MB image cap. */
export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Files below this are sent untouched (re-encoding is not worth it). */
const SKIP_COMPRESSION_BYTES = 800 * 1024;

/**
 * @param {File} file
 * @param {{ maxWidth?: number, maxHeight?: number, maxBytes?: number }} [options]
 * @returns {Promise<File>} the original file, or a compressed replacement
 */
export async function prepareImageForUpload(file, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    maxBytes = MAX_IMAGE_UPLOAD_BYTES,
  } = options;

  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new Error('not_image');
  }
  if (Number(file.size) > maxBytes) {
    throw new Error('too_large');
  }
  if (Number(file.size) <= SKIP_COMPRESSION_BYTES) {
    return file;
  }

  try {
    const result = await compressImage(file, {
      maxWidth,
      maxHeight,
      quality: 0.85,
      outputFormat: 'auto',
    });
    // The compressor is best-effort: if it bails (unsupported codec,
    // SVG, tiny file) keep the original rather than failing the upload.
    return result?.file || file;
  } catch {
    return file;
  }
}
