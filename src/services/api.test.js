import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// The stub client must exist BEFORE ./api runs axios.create() at module
// load, so it is built inside the mock factory.
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    post: vi.fn(),
  },
}));

// Imported AFTER the mock so the module wires the stubbed client.
const { marketplaceService } = await import('./api');

// The single client instance created at module load.
const mockPost = axios.create.mock.results[0].value.post;

beforeEach(() => {
  mockPost.mockReset();
});

describe('marketplaceService.bulkDeleteVariants', () => {
  it('sends a single request for 100 or fewer ids', async () => {
    mockPost.mockResolvedValue({ data: { deleted: 2 } });
    const res = await marketplaceService.bulkDeleteVariants([7, 9]);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'marketplace/product-variants/bulk-delete/',
      { ids: [7, 9] },
    );
    expect(res.data.deleted).toBe(2);
  });

  it('splits 303 ids into 100/100/100/3 batches and totals the result', async () => {
    const ids = Array.from({ length: 303 }, (_, i) => i + 1);
    // NOTE: axios post signature is (url, body) — read the body arg.
    mockPost.mockImplementation((url, body) =>
      Promise.resolve({ data: { deleted: body.ids.length } }),
    );
    const res = await marketplaceService.bulkDeleteVariants(ids);
    expect(mockPost).toHaveBeenCalledTimes(4);
    expect(mockPost.mock.calls[0][1]).toEqual({ ids: ids.slice(0, 100) });
    expect(mockPost.mock.calls[1][1]).toEqual({ ids: ids.slice(100, 200) });
    expect(mockPost.mock.calls[2][1]).toEqual({ ids: ids.slice(200, 300) });
    expect(mockPost.mock.calls[3][1]).toEqual({ ids: ids.slice(300, 303) });
    expect(res.data.deleted).toBe(303);
  });

  it('sends no request for an empty selection', async () => {
    const res = await marketplaceService.bulkDeleteVariants([]);
    expect(mockPost).not.toHaveBeenCalled();
    expect(res.data.deleted).toBe(0);
  });
});
