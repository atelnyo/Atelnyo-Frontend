import { describe, expect, it } from 'vitest';
import {
  STUDIO_DEFAULT_SECTION, STUDIO_ROOT, isStudioSection, resolveStudioSection,
  studioSectionPath,
} from './studioRoute';

const IDS = ['dashboard', 'courses', 'products', 'media', 'public_profile'];

describe('studioSectionPath', () => {
  it('keeps the dashboard on the bare Studio root', () => {
    expect(studioSectionPath('dashboard')).toBe('/studio');
    expect(studioSectionPath('')).toBe('/studio');
    expect(studioSectionPath(null)).toBe('/studio');
  });

  it('builds a canonical path for every other section', () => {
    expect(studioSectionPath('courses')).toBe('/studio/courses');
    expect(studioSectionPath(' public_profile ')).toBe('/studio/public_profile');
    expect(STUDIO_ROOT).toBe('/studio');
  });

  it('encodes ids so a route segment can never break the path', () => {
    expect(studioSectionPath('a/b')).toBe('/studio/a%2Fb');
  });
});

describe('isStudioSection', () => {
  it('only accepts ids the Studio renders', () => {
    expect(isStudioSection('courses', IDS)).toBe(true);
    expect(isStudioSection('nope', IDS)).toBe(false);
    expect(isStudioSection('', IDS)).toBe(false);
    expect(isStudioSection('courses', [])).toBe(false);
  });
});

describe('resolveStudioSection', () => {
  it('opens the section named by the path', () => {
    expect(resolveStudioSection(IDS, { pathSection: 'products' })).toEqual({
      section: 'products', requested: 'products', unknown: null,
    });
  });

  it('lets the path win over the legacy ?section=', () => {
    expect(
      resolveStudioSection(IDS, { pathSection: 'courses', querySection: 'wallet' }).section,
    ).toBe('courses');
  });

  it('supports the legacy query shape when there is no path section', () => {
    expect(resolveStudioSection(IDS, { querySection: 'media' }).section).toBe('media');
  });

  it('reports a stale section instead of faking the dashboard', () => {
    expect(resolveStudioSection(IDS, { pathSection: 'deleted_section' })).toEqual({
      section: STUDIO_DEFAULT_SECTION, requested: 'deleted_section', unknown: 'deleted_section',
    });
    expect(resolveStudioSection(IDS, { querySection: 'ghost' }).unknown).toBe('ghost');
  });

  it('restores the last visited section when the URL says nothing', () => {
    expect(resolveStudioSection(IDS, { savedSection: 'products' })).toEqual({
      section: 'products', requested: null, unknown: null,
    });
  });

  it('ignores a saved section that no longer exists, and defaults otherwise', () => {
    expect(resolveStudioSection(IDS, { savedSection: 'retired' }).section).toBe(STUDIO_DEFAULT_SECTION);
    expect(resolveStudioSection(IDS)).toEqual({
      section: STUDIO_DEFAULT_SECTION, requested: null, unknown: null,
    });
  });
});
