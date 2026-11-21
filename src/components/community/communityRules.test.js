import { describe, expect, it } from 'vitest';
import { visibleCommunityRules } from './communityRules';

describe('visibleCommunityRules', () => {
  it('keeps active rules and drops explicitly inactive ones', () => {
    const rules = [
      { id: 1, title: 'Active', order: 0 },
      { id: 2, title: 'Hidden', order: 1, is_active: false },
      { id: 3, title: 'Also active', order: 2, is_active: true },
    ];

    expect(visibleCommunityRules(rules).map((rule) => rule.title)).toEqual([
      'Active',
      'Also active',
    ]);
  });

  it('orders rules by their stored position', () => {
    const rules = [
      { title: 'Third', order: 2 },
      { title: 'First', order: 0 },
      { title: 'Second', order: 1 },
    ];

    expect(visibleCommunityRules(rules).map((rule) => rule.title)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('returns an empty list for missing or malformed data', () => {
    expect(visibleCommunityRules(undefined)).toEqual([]);
    expect(visibleCommunityRules(null)).toEqual([]);
    expect(visibleCommunityRules('rule')).toEqual([]);
  });
});
