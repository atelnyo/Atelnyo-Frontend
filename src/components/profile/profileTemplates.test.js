/**
 * src/components/profile/profileTemplates.test.js
 *
 * Guards the shared profile-layout presets:
 *   • every template covers every known section exactly once;
 *   • applying a template returns a detached config;
 *   • detection round-trips presets and reports custom configs as null;
 *   • mergeSectionConfig repairs malformed/partial saved configs.
 */
import { describe, it, expect } from 'vitest';
import {
  PROFILE_SECTION_IDS,
  PROFILE_TEMPLATES,
  applyProfileTemplate,
  detectProfileTemplate,
  getProfileTemplate,
  mergeSectionConfig,
  templateDescription,
  templateName,
} from './profileTemplates';

describe('profileTemplates', () => {
  it('every template covers each known section exactly once', () => {
    for (const template of PROFILE_TEMPLATES) {
      const config = applyProfileTemplate(template);
      expect(config.section_order).toHaveLength(PROFILE_SECTION_IDS.length);
      expect([...config.section_order].sort()).toEqual([...PROFILE_SECTION_IDS].sort());
      for (const id of PROFILE_SECTION_IDS) {
        expect(typeof config.section_visibility[id]).toBe('boolean');
      }
    }
  });

  it('applying a template returns a detached copy (no shared mutation)', () => {
    const template = getProfileTemplate('academy');
    const first = applyProfileTemplate(template);
    first.section_order.reverse();
    first.section_visibility.courses = false;

    const second = applyProfileTemplate(template);
    expect(second.section_order[0]).toBe('courses');
    expect(second.section_visibility.courses).toBe(true);
  });

  it('detects each preset and reports customized configs as null', () => {
    for (const template of PROFILE_TEMPLATES) {
      expect(detectProfileTemplate(applyProfileTemplate(template))).toBe(template.id);
    }
    const custom = applyProfileTemplate(getProfileTemplate('academy'));
    custom.section_visibility.reviews = false;
    expect(detectProfileTemplate(custom)).toBeNull();
  });

  it('preserves unknown forward-compatible sections when applying a template', () => {
    const current = {
      section_order: ['future-section', 'about', 'picks', 'courses'],
      section_visibility: { about: true, picks: true, courses: true, 'future-section': false },
    };
    const config = applyProfileTemplate(getProfileTemplate('academy'), current);

    expect(config.section_order[0]).toBe('courses');
    expect(config.section_order).toContain('future-section');
    expect(config.section_visibility['future-section']).toBe(false);
    // The unknown id must not turn the preset into "Custom".
    expect(detectProfileTemplate(config)).toBe('academy');
  });

  it('merges partial configs without dropping unknown or missing sections', () => {
    const merged = mergeSectionConfig({
      section_order: ['about', 'about', 'future-section', 42],
      section_visibility: { about: false, 'future-section': true },
    });
    expect(merged.section_order[0]).toBe('about');
    expect(merged.section_order).toContain('future-section');
    expect(merged.section_order).toContain('dashboard');
    expect(merged.section_visibility.about).toBe(false);
    expect(merged.section_visibility.courses).toBe(true);
  });

  it('localizes template name/description with an English fallback', () => {
    const template = getProfileTemplate('store');
    expect(templateName(template, 'ht')).toBe('Boutik');
    expect(templateDescription(template, 'xx')).toContain('Products');
    expect(templateName(null, 'ht')).toBe('');
  });
});
