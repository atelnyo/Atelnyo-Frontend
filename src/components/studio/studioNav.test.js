import { describe, expect, it } from 'vitest';

import { formatBadge, navBadges } from './studioNav';

const OVERVIEW = {
  content: {
    courses: { total: 5, published: 2, draft: 3 },
    products: { total: 9, published: 9, draft: 0 },
  },
  commerce: { orders: { total: 7, pending: 4, paid: 3 } },
};

describe('navBadges', () => {
  it('surfaces only actionable counts', () => {
    expect(navBadges(OVERVIEW)).toEqual({ courses: 3, orders: 4 });
  });

  it('does not badge totals', () => {
    const badges = navBadges(OVERVIEW);
    expect(Object.keys(badges).sort()).toEqual(['courses', 'orders']);
  });

  it('stays at zero for a missing or partial payload', () => {
    expect(navBadges(null)).toEqual({ courses: 0, orders: 0 });
    expect(navBadges({ content: {} })).toEqual({ courses: 0, orders: 0 });
    expect(navBadges({ commerce: { orders: { pending: 2 } } }))
      .toEqual({ courses: 0, orders: 2 });
  });
});

describe('formatBadge', () => {
  it('renders nothing when there is nothing to do', () => {
    expect(formatBadge(0)).toBe('');
    expect(formatBadge(null)).toBe('');
    expect(formatBadge(-2)).toBe('');
    expect(formatBadge('nope')).toBe('');
  });

  it('renders plain counts and caps at 99+', () => {
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge('12')).toBe('12');
    expect(formatBadge(99)).toBe('99');
    expect(formatBadge(100)).toBe('99+');
  });
});
