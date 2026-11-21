import { describe, it, expect } from 'vitest';
import { localizedCategoryLabel } from './communityCategories';

describe('localizedCategoryLabel', () => {
  it('translates the API display name in French and Creole', () => {
    expect(localizedCategoryLabel('Other', 'fr')).toBe('Autre');
    expect(localizedCategoryLabel('Other', 'ht')).toBe('Lòt');
    expect(localizedCategoryLabel('Technology', 'fr')).toBe('Technologie');
  });

  it('accepts the slug used by the creation form', () => {
    expect(localizedCategoryLabel('art', 'fr')).toBe('Art et design');
  });

  it('preserves unknown creator-defined categories', () => {
    expect(localizedCategoryLabel('Bicycle repair', 'fr')).toBe('Bicycle repair');
  });

  it('falls back to the localized Other label when empty', () => {
    expect(localizedCategoryLabel('', 'fr')).toBe('Autre');
  });
});
