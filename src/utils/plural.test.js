import { describe, it, expect } from 'vitest';
import { pluralize, countWithUnit } from './plural';

const RULES = {
  ht: { one: 'règ', many: 'règ' },
  en: { one: 'rule', many: 'rules' },
  fr: { one: 'règle', many: 'règles' },
};

describe('pluralize', () => {
  it('uses the singular only for one', () => {
    expect(pluralize('en', 1, RULES)).toBe('rule');
    expect(pluralize('en', 0, RULES)).toBe('rules');
    expect(pluralize('en', 2, RULES)).toBe('rules');
    expect(pluralize('fr', 1, RULES)).toBe('règle');
    expect(pluralize('fr', 2, RULES)).toBe('règles');
  });

  it('keeps Haitian Creole invariant and falls back to English for unsupported codes', () => {
    expect(pluralize('ht', 1, RULES)).toBe('règ');
    expect(pluralize('ht', 5, RULES)).toBe('règ');
    expect(pluralize('es', 1, RULES)).toBe('rule');
  });

  it('builds the full count label', () => {
    expect(countWithUnit('fr', 1, RULES)).toBe('1 règle');
    expect(countWithUnit('fr', 3, RULES)).toBe('3 règles');
    expect(countWithUnit('en', 0, RULES)).toBe('0 rules');
  });
});
