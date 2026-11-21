import { describe, it, expect } from 'vitest';
import {
  RULE_TEMPLATE_CATEGORIES,
  listTemplateRules,
  mergeRuleLists,
  normalizeRuleTitle,
  rulesFromSelection,
  ruleTemplateLang,
} from './ruleTemplates';

describe('rule template library', () => {
  it('ships the six requested categories with complete ht/en/fr copy', () => {
    expect(RULE_TEMPLATE_CATEGORIES.map((category) => category.id)).toEqual([
      'respect', 'content', 'spam', 'privacy', 'participation', 'commerce',
    ]);

    for (const category of RULE_TEMPLATE_CATEGORIES) {
      for (const language of ['ht', 'en', 'fr']) {
        expect(category.label[language]).toBeTruthy();
        for (const rule of category.rules) {
          expect(rule.title[language]).toBeTruthy();
          expect(rule.description[language]).toBeTruthy();
        }
      }
    }
  });

  it('produces unique stable keys and localized rules in library order', () => {
    const rules = listTemplateRules('fr');
    const keys = rules.map((rule) => rule.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rules[0].key).toBe('respect:be-respectful');
    expect(rules[0].title).toBe('Soyez respectueux');
    expect(listTemplateRules('es')[0].title).toBe('Be respectful');
  });

  it('keeps selection order independent from click order', () => {
    const selected = ['spam:no-spam', 'respect:be-respectful'];
    expect(rulesFromSelection(selected, 'en').map((rule) => rule.key)).toEqual([
      'respect:be-respectful', 'spam:no-spam',
    ]);
  });

  it('appends new rules without replacing or duplicating existing ones', () => {
    const existing = [{ title: 'Be respectful', description: 'Mine' }];
    const merged = mergeRuleLists(existing, [
      { title: '  be   RESPECTFUL ', description: 'Template copy' },
      { title: 'Stay on topic', description: 'Relevant content only.' },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0].description).toBe('Mine');
    expect(merged[1].title).toBe('Stay on topic');
  });

  it('normalizes language codes and titles for comparison', () => {
    expect(ruleTemplateLang('fr-CA')).toBe('fr');
    expect(ruleTemplateLang('es')).toBe('en');
    expect(normalizeRuleTitle('  No   SPAM ')).toBe('no spam');
  });
});
