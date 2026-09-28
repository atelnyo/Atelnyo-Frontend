/**
 * src/utils/webpDetection.js
 *
 * WebP browser detection utility.
 * Detects if the current browser supports WebP format for image compression.
 *
 * Features:
 *   - Detects WebP support via canvas toDataURL
 *   - Caches result for performance
 *   - Returns support status and recommended format
 */

// Cache the detection result
let webpSupportCache = null;

/**
 * Detect if the browser supports WebP format.
 *
 * @returns {Promise<{supported: boolean, format: string, reason: string}>}
 */
export async function detectWebPSupport() {
  // Return cached result if available
  if (webpSupportCache !== null) {
    return webpSupportCache;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      webpSupportCache = {
        supported: false,
        format: 'image/jpeg',
        reason: 'Canvas context not available',
      };
      return webpSupportCache;
    }

    // Try to export as WebP
    const dataUrl = canvas.toDataURL('image/webp');

    // Check if the data URL contains WebP data
    const isWebP = dataUrl.indexOf('data:image/webp') === 0;

    webpSupportCache = {
      supported: isWebP,
      format: isWebP ? 'image/webp' : 'image/jpeg',
      reason: isWebP ? 'Browser supports WebP' : 'Browser does not support WebP',
    };

    return webpSupportCache;
  } catch (err) {
    webpSupportCache = {
      supported: false,
      format: 'image/jpeg',
      reason: `Detection failed: ${err.message}`,
    };
    return webpSupportCache;
  }
}

/**
 * Get the best supported image format.
 * Returns 'image/webp' if supported, otherwise 'image/jpeg'.
 *
 * @returns {string} Best supported format MIME type
 */
export function getBestFormat() {
  if (webpSupportCache) {
    return webpSupportCache.format;
  }
  // Default to JPEG if detection hasn't run yet
  return 'image/jpeg';
}

/**
 * Get browser info for debugging.
 *
 * @returns {{ua: string, webpSupported: boolean | null}}
 */
export function getBrowserInfo() {
  return {
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    webpSupported: webpSupportCache?.supported ?? null,
  };
}

/**
 * Clear the cached detection result.
 * Useful for testing or when browser capabilities change.
 */
export function clearWebPCache() {
  webpSupportCache = null;
}
