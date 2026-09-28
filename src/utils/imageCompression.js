/**
 * src/utils/imageCompression.js
 *
 * Client-side image compression using Canvas API.
 * Compresses images before upload to reduce bandwidth and improve performance.
 *
 * Features:
 *   - Resizes to max dimensions (preserves aspect ratio)
 *   - Compresses to target quality (JPEG/WebP)
 *   - Returns compressed File/Blob ready for upload
 *   - Works in all modern browsers
 */

/**
 * Compress an image file before upload.
 *
 * @param {File} file - The original image file
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Max width in pixels (default: 1200)
 * @param {number} options.maxHeight - Max height in pixels (default: 800)
 * @param {number} options.quality - JPEG/WebP quality 0-1 (default: 0.8)
 * @param {string} options.outputFormat - 'image/jpeg' or 'image/webp' (default: 'image/jpeg')
 * @returns {Promise<{file: File, width: number, height: number, originalSize: number, compressedSize: number}>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 800,
    quality = 0.8,
    outputFormat = 'image/jpeg',
    onProgress = null,
  } = options;

  // Auto-detect best format if 'auto' is specified
  let actualFormat = outputFormat;
  if (outputFormat === 'auto') {
    try {
      const { detectWebPSupport } = await import('./webpDetection');
      const support = await detectWebPSupport();
      actualFormat = support.format;
    } catch {
      // Fallback: try canvas directly
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        actualFormat = supportsWebP ? 'image/webp' : 'image/jpeg';
      } catch {
        actualFormat = 'image/jpeg';
      }
    }
  }

  return new Promise((resolve, reject) => {
    // Validate input
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Not an image file'));
      return;
    }

    // Report initial progress
    if (onProgress) onProgress({ stage: 'reading', percent: 0 });

    // If file is already small enough, skip compression
    if (file.size < 100 * 1024) { // < 100KB
      if (onProgress) onProgress({ stage: 'done', percent: 100, skipped: true });
      resolve({
        file,
        width: 0,
        height: 0,
        originalSize: file.size,
        compressedSize: file.size,
        skipped: true,
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if (onProgress) onProgress({ stage: 'loading', percent: 25 });
      const img = new Image();

      img.onload = () => {
        if (onProgress) onProgress({ stage: 'processing', percent: 50 });
        let { width, height } = img;

        // Calculate new dimensions (maintain aspect ratio)
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Use high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the resized image
        ctx.drawImage(img, 0, 0, width, height);

        if (onProgress) onProgress({ stage: 'compressing', percent: 75 });

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed'));
              return;
            }

            // Determine file extension based on format
            const ext = actualFormat === 'image/webp' ? 'webp' : 'jpg';
            const baseName = file.name.replace(/\.[^.]+$/, '');

            // Create a new File from the blob
            const compressedFile = new File([blob], `${baseName}.${ext}`, {
              type: actualFormat,
              lastModified: Date.now(),
            });

            if (onProgress) onProgress({ stage: 'done', percent: 100 });
            resolve({
              file: compressedFile,
              width,
              height,
              originalSize: file.size,
              compressedSize: compressedFile.size,
              skipped: false,
            });
          },
          outputFormat,
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display.
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted string (e.g., "1.2 MB")
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Calculate compression ratio.
 *
 * @param {number} original - Original size in bytes
 * @param {number} compressed - Compressed size in bytes
 * @returns {string} Percentage string (e.g., "65% smaller")
 */
export function compressionRatio(original, compressed) {
  if (original === 0) return '0%';
  const ratio = ((1 - compressed / original) * 100).toFixed(0);
  return `${ratio}% smaller`;
}
