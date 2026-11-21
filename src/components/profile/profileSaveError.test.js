import { describe, it, expect } from 'vitest';
import { parseProfileSaveError } from './profileSaveError';

describe('parseProfileSaveError', () => {
  it('maps DRF field errors to labels and editor tabs', () => {
    const result = parseProfileSaveError({
      response: {
        status: 400,
        data: {
          bio: ['Bios la twò long.'],
          seo_title: 'Tit la obligatwa.',
          detail: 'Validation failed.',
        },
      },
    }, 'ht');

    expect(result.message).toBe('Validation failed.');
    expect(result.fields).toEqual([
      { field: 'bio', label: 'Biyografi', message: 'Bios la twò long.', tab: 'profile' },
      { field: 'seo_title', label: 'Tit SEO', message: 'Tit la obligatwa.', tab: 'seo' },
    ]);
  });

  it('reads the errors object used by server-side gates', () => {
    const result = parseProfileSaveError({
      response: {
        status: 400,
        data: { errors: { artist_name: ['Non an obligatwa.'] } },
      },
    }, 'ht');

    expect(result.fields[0]).toMatchObject({
      field: 'artist_name',
      label: 'Non atis',
      message: 'Non an obligatwa.',
      tab: 'appearance',
    });
    expect(result.message).toBeTruthy();
  });

  it('returns a localized network message when there is no response body', () => {
    const result = parseProfileSaveError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    }, 'ht');

    expect(result.fields).toEqual([]);
    expect(result.message).toContain('koneksyon');
  });
});
