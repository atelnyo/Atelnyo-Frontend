/**
 * CreatorApply wizard logic tests — pure helpers, no rendering.
 *
 * Covers the two applicant-facing bugs fixed in this change:
 *   - getStatusDisplay must return a non-empty label/hint for every
 *     known status in both languages (the dashboard hero used to
 *     render empty via a generic obj[lang] lookup).
 *   - validateStep gates each wizard step with localized messages.
 */
import { describe, it, expect } from 'vitest';
import { validateStep, getStatusDisplay } from './CreatorApply';

const FULL_FORM = {
  full_name: 'Jan Pyè',
  date_of_birth: '1990-01-01',
  identity_type: 'passport',
  identity_document_url: '',
  country: 'HT',
  city: 'Pòtoprens',
  biography: 'Mwen anseye mizik depi 5 an nan kominote mwen.',
  languages: 'Kreyòl, Fransè',
  why_creator: 'Mwen vle pataje konesans mwen ak tout Ayiti.',
  experience_years: '1-3',
  experience_description: 'Mwen anseye gita ak pyano nan lekòl kominotè.',
  education: '',
  categories: 'Mizik',
  skills: 'Gita',
  specialties: '',
  portfolio_url: '',
  portfolio_description: '',
  contact_email: 'jan@example.com',
  terms_accepted: true,
  code_of_conduct_accepted: true,
  content_guidelines_accepted: true,
};

describe('getStatusDisplay', () => {
  const statuses = ['draft', 'submitted', 'under_review', 'need_information', 'approved', 'rejected', 'suspended'];
  it.each(statuses)('returns a non-empty ht label/hint for %s', (status) => {
    const d = getStatusDisplay(status, 'ht');
    expect(d.label).toBeTruthy();
    expect(d.hint).toBeTruthy();
  });
  it.each(statuses)('returns a non-empty en label/hint for %s', (status) => {
    const d = getStatusDisplay(status, 'en');
    expect(d.label).toBeTruthy();
    expect(d.hint).toBeTruthy();
  });
  it('falls back to draft for unknown statuses', () => {
    expect(getStatusDisplay('bogus', 'ht').label).toBe(
      getStatusDisplay('draft', 'ht').label,
    );
  });
});

describe('validateStep', () => {
  it('passes a complete form on every validated step', () => {
    for (const step of [1, 2, 3, 4, 6, 7]) {
      expect(validateStep(step, FULL_FORM, 'ht')).toEqual({});
      expect(validateStep(step, FULL_FORM, 'en')).toEqual({});
    }
  });
  it('flags missing identity fields in Creole', () => {
    const errs = validateStep(1, { ...FULL_FORM, full_name: '', identity_type: '' }, 'ht');
    expect(errs.full_name).toBeTruthy();
    expect(errs.identity_type).toBeTruthy();
  });
  it('rejects short biographies with a character count', () => {
    const errs = validateStep(2, { ...FULL_FORM, biography: 'kout' }, 'en');
    expect(errs.biography).toMatch(/20/);
  });
  it('rejects invalid contact emails', () => {
    expect(validateStep(6, { ...FULL_FORM, contact_email: 'not-an-email' }, 'ht').contact_email).toBeTruthy();
    expect(validateStep(6, { ...FULL_FORM, contact_email: '' }, 'en').contact_email).toBeTruthy();
  });
  it('requires all three terms acceptances', () => {
    const errs = validateStep(7, { ...FULL_FORM, terms_accepted: false, code_of_conduct_accepted: false }, 'ht');
    expect(errs.terms_accepted).toBeTruthy();
    expect(errs.code_of_conduct_accepted).toBeTruthy();
    expect(errs.content_guidelines_accepted).toBeFalsy();
  });
});
