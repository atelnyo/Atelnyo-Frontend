import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../services/api';
import { storeService } from './storeService';

describe('storeService.createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.post.mockResolvedValue({ data: { id: 1 } });
  });

  it('sends the active interface language with the order', async () => {
    localStorage.setItem('atelnyo_lang', 'fr-FR');

    await storeService.createOrder([{ product_id: 1, quantity: 1 }], null, null, null);

    expect(api.post).toHaveBeenCalledWith(
      'marketplace/orders/',
      expect.objectContaining({ language: 'fr' }),
    );
  });

  it('falls back to English for an unsupported stored language', async () => {
    localStorage.setItem('atelnyo_lang', 'de');

    await storeService.createOrder([{ product_id: 1, quantity: 1 }], null, null, null);

    expect(api.post).toHaveBeenCalledWith(
      'marketplace/orders/',
      expect.objectContaining({ language: 'en' }),
    );
  });
});
