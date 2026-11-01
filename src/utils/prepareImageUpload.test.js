import { describe, it, expect } from 'vitest';
import {
  prepareImageForUpload,
  MAX_IMAGE_UPLOAD_BYTES,
} from './prepareImageUpload';

const imageFile = (bytes, type = 'image/png', name = 'photo.png') =>
  new File([new Uint8Array(bytes)], name, { type });

describe('prepareImageForUpload', () => {
  it('rejects non-image files', async () => {
    await expect(
      prepareImageForUpload(new File(['not an image'], 'notes.txt', { type: 'text/plain' })),
    ).rejects.toThrow('not_image');
  });

  it('rejects files above the cap without touching them', async () => {
    // Only the declared size is inspected — no pixel decode happens for
    // an oversized file (that is the point of checking size first).
    const oversized = imageFile(10);
    Object.defineProperty(oversized, 'size', { value: MAX_IMAGE_UPLOAD_BYTES + 1 });
    await expect(prepareImageForUpload(oversized)).rejects.toThrow('too_large');
  });

  it('passes a small image through untouched', async () => {
    const small = imageFile(1024);
    await expect(prepareImageForUpload(small)).resolves.toBe(small);
  });
});
