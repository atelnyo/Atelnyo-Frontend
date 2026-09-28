/**
 * src/components/CreatorApply.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROMPT 22 — Creator Apply Ecosystem
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Premye ekran:    Introduction (konvenk itilizatè a)
 * Dezyèm ekran:    9-step wizard (Identity → Submit)
 * Twazyèm ekran:   Status Dashboard (après soumèt)
 *
 * Autosave:      localStorage (atelnyo_creator_apply_draft)
 * Status:        draft → submitted → under_review → approved|rejected|need_information
 *                rejected → re-submit | approved → suspended (admin)
 *
 * Gating:
 *   1. Anonymous → /sheet/auth
 *   2. No unlock flag → / (3-tap easter egg nan Settings)
 *
 * Every screen has: header, subtitle, CTA, loading, empty, error, success states.
 * Micro-interactions: button transitions, skeleton shimmer, toast feedback.
 * Design consistency: same spacing, colors, typography as Creator Studio.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { Navigate } from 'react-router-dom';
import { creatorIdentityService } from '../services/api';
import { translations as i18n } from '../data/translations';
import { useRoleGate } from '../hooks/useRoleGate';
// Draft protection — the form layer's autosave POLICY (when to save /
// remove) runs HERE; the draftStore PRIMITIVE (private:drafts:<id>,
// IndexedDB — survives reload/restart/OS-kill/offline, rides along in
// backup/export/clear-data) is reached only through these façades.
import { saveFormDraft, restoreFormDraft, removeFormDraft } from '../services/appStateStore';
// Continuity — records the draft INDEX in the restore point so the
// RestoreBanner can announce "an unsaved draft is saved" after a
// relaunch. Content stays in the draftStore; only the id rides the
// continuity state (meaningful identity, never the payload).
import continuityManager from '../pwa/continuity/ContinuityManager';

// ─── Constants ────────────────────────────────────────────────────────────

const LS_KEY = 'atelnyo_creator_apply_unlocked';
const DRAFT_KEY = 'atelnyo_creator_apply_draft';

// The untouched default form (also the draft-restore base — a local
// draft merges ONTO it, never onto a form the user already edited).
const DEFAULT_FORM = {
  full_name: '', date_of_birth: '', identity_type: '', identity_document_url: '',
  country: 'HT', city: '', biography: '', languages: '', why_creator: '',
  experience_years: '', experience_description: '', education: '',
  categories: '', skills: '', specialties: '',
  portfolio_url: '', portfolio_description: '',
  social_twitter: '', social_github: '', social_linkedin: '', social_youtube: '', social_instagram: '', social_facebook: '',
  website_url: '', contact_email: '',
  terms_accepted: false, code_of_conduct_accepted: false, content_guidelines_accepted: false,
};

// First-wins guard: is the form STILL the untouched default? (Server
// fetch, server draft, and the user's own typing all beat a local
// draft — the local copy applies only while this is true.)
function isDefaultForm(f) {
  if (!f || typeof f !== 'object') { return true; }
  return !f.full_name && !f.biography && !f.why_creator
    && !f.experience_description && !f.contact_email;
}

const TOTAL_STEPS = 9;

const STEPS_META = [
  { id: 'identity',    icon: 'fa-id-card',   labelEn: 'Identity',          labelHt: 'Idantite' },
  { id: 'info',        icon: 'fa-user',      labelEn: 'Creator Info',      labelHt: 'Enfòmasyon' },
  { id: 'experience',  icon: 'fa-briefcase', labelEn: 'Experience',        labelHt: 'Eksperyans' },
  { id: 'category',    icon: 'fa-tag',       labelEn: 'Category',          labelHt: 'Kategori' },
  { id: 'portfolio',   icon: 'fa-palette',   labelEn: 'Portfolio',         labelHt: 'Pòtfolyo' },
  { id: 'social',      icon: 'fa-share-alt', labelEn: 'Social Links',      labelHt: 'Sosyal' },
  { id: 'terms',       icon: 'fa-file-contract', labelEn: 'Terms',         labelHt: 'Kondisyon' },
  { id: 'review',      icon: 'fa-clipboard-check', labelEn: 'Review',      labelHt: 'Revize' },
  { id: 'submit',      icon: 'fa-paper-plane', labelEn: 'Submit',          labelHt: 'Voye' },
];

const STATUS_CONFIG = {
  draft:            { icon: 'fa-pen',          labelEn: 'Draft',          labelHt: 'Bwouyon',  color: '#94a3b8', hintEn: 'Complete your application when you\'re ready.', hintHt: 'Finisman aplikasyon ou an lè w pare.' },
  submitted:        { icon: 'fa-hourglass-half', labelEn: 'Submitted',     labelHt: 'Voye',     color: '#f59e0b', hintEn: 'We\'ve received your application!', hintHt: 'N ap resevwa aplikasyon ou an!' },
  under_review:     { icon: 'fa-magnifying-glass', labelEn: 'Under Review', labelHt: 'Ap Revize', color: '#38bdf8', hintEn: 'Our team is reviewing your application.', hintHt: 'Ekip n ap revize aplikasyon ou an.' },
  need_information: { icon: 'fa-circle-info',  labelEn: 'Need Information', labelHt: 'Bezwen Plis', color: '#f97316', hintEn: 'We need more information. Check our message.', hintHt: 'N bezwen plis enfòmasyon. Tcheke mesaj nou an.' },
  approved:         { icon: 'fa-circle-check', labelEn: 'Approved 🎉',     labelHt: 'Apwouve 🎉', color: '#10b981', hintEn: 'Congratulations! You\'re now a creator.', hintHt: 'Felisitasyon! Ou vin yon kreyatè.' },
  rejected:         { icon: 'fa-circle-xmark', labelEn: 'Rejected',        labelHt: 'Rejete',   color: '#ef4444', hintEn: 'Your application was not approved.', hintHt: 'Aplikasyon ou an pa apwouve.' },
  suspended:        { icon: 'fa-ban',          labelEn: 'Suspended',       labelHt: 'Sispann',  color: '#dc2626', hintEn: 'Your creator status has been suspended.', hintHt: 'Estati kreyatè ou an sispann.' },
};

const ESTIMATED_WAIT = {
  submitted:        { en: 'Usually reviewed within 48 hours',  ht: 'Anjeneral revize anba 48 èdtan' },
  under_review:     { en: 'Typically takes 24-72 hours',      ht: 'Anjeneral pran 24-72 èdtan' },
  need_information: { en: 'Respond within 7 days',            ht: 'Reponn anba 7 jou' },
};

const COUNTRY_PRESETS = [
  { code: 'HT', label: 'Ayiti' }, { code: 'US', label: 'Etazini' },
  { code: 'CA', label: 'Kanada' }, { code: 'FR', label: 'Frans' },
  { code: 'BR', label: 'Brezil' }, { code: 'DO', label: 'Dominikani' },
  { code: 'CU', label: 'Kiba' }, { code: 'MX', label: 'Meksik' },
  { code: 'CH', label: 'Swis' }, { code: 'BE', label: 'Bèljik' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', labelEn: 'Select...', labelHt: 'Chwazi...' },
  { value: '0-1', labelEn: '0-1 years', labelHt: '0-1 ane' },
  { value: '1-3', labelEn: '1-3 years', labelHt: '1-3 ane' },
  { value: '3-5', labelEn: '3-5 years', labelHt: '3-5 ane' },
  { value: '5-10', labelEn: '5-10 years', labelHt: '5-10 ane' },
  { value: '10+', labelEn: '10+ years', labelHt: '10+ ane' },
];

const IDENTITY_TYPES = [
  { value: '', labelEn: 'Select...', labelHt: 'Chwazi...' },
  { value: 'passport', labelEn: 'Passport', labelHt: 'Paspò' },
  { value: 'national_id', labelEn: 'National ID', labelHt: 'Kat Idantite' },
  { value: 'driver_license', labelEn: 'Driver License', labelHt: 'Pèmi Kondwi' },
  { value: 'residence_permit', labelEn: 'Residence Permit', labelHt: 'Pèmi Rezidans' },
];

function tVal(lang, obj) {
  return obj?.[lang] || obj?.en || '';
}

// ─── Sub-components ───────────────────────────────────────────────────────

function CreatorSkeleton({ rows = 6 }) {
  return (
    <div className="ca-skel-list" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ca-skel-row" aria-hidden="true" />
      ))}
    </div>
  );
}

function NextAction({ status, lang, onAction }) {
  const actionMap = {
    rejected: {
      en: 'Update your information and re-apply',
      ht: 'Mete enfòmasyon ou yo ajou epi aplike ankò',
    },
    need_information: {
      en: 'Check our message and update your application',
      ht: 'Tcheke mesaj nou an epi mete aplikasyon ou ajou',
    },
    draft: {
      en: 'Continue your application',
      ht: 'Kontinye aplikasyon ou',
    },
  };
  const action = actionMap[status];
  if (!action) return null;
  return (
    <button type="button" className="btn-primary ca-next-action" onClick={onAction}>
      <i className="fas fa-arrow-right" aria-hidden="true" />
      {tVal(lang, action)}
    </button>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════
// INTRODUCTION PAGE
// ═══════════════════════════════════════════════════════════════════════════

function IntroductionPage({ lang, onStart }) {
  const isHt = lang === 'ht';
  return (
    <div className="ca-intro">
      <div className="ca-intro-hero">
        <div className="ca-intro-icon">
          <i className="fas fa-crown" aria-hidden="true" />
        </div>
        <h1 className="ca-intro-title">
          {isHt ? 'Vin yon Kreyatè Atelnyo' : 'Become an Atelnyo Creator'}
        </h1>
        <p className="ca-intro-subtitle">
          {isHt
            ? 'Jwenn yon espas pou pataje konesans ou, kreye revni, epi konstwi yon kominote.'
            : 'Get a space to share your knowledge, earn revenue, and build a community.'}
        </p>
      </div>

      <div className="ca-intro-benefits">
        <h3>{isHt ? 'Avantaj' : 'Benefits'}</h3>
        <div className="ca-intro-benefit-grid">
          {[
            { icon: 'fa-graduation-cap', en: 'Teach Courses', ht: 'Anseye Kou' },
            { icon: 'fa-music', en: 'Share Music', ht: 'Pataje Mizik' },
            { icon: 'fa-cube', en: 'Sell Products', ht: 'Vann Pwodwi' },
            { icon: 'fa-wallet', en: 'Earn Revenue', ht: 'Jwenn Revni' },
            { icon: 'fa-users', en: 'Build Community', ht: 'Konstwi Kominote' },
            { icon: 'fa-trophy', en: 'Get Verified', ht: 'Verifye' },
          ].map((b) => (
            <div key={b.icon} className="ca-intro-benefit">
              <i className={`fas ${b.icon}`} aria-hidden="true" />
              <span>{isHt ? b.ht : b.en}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ca-intro-responsibilities">
        <h4>{isHt ? 'Responsabilite ou' : 'Your Responsibilities'}</h4>
        <ul>
          {[
            isHt ? 'Respekte règ platfòm nan' : 'Follow platform rules',
            isHt ? 'Pataje kontni orijinal' : 'Share original content',
            isHt ? 'Kenbe yon bon kondwit' : 'Maintain good conduct',
            isHt ? 'Reponn itilizatè yo' : 'Respond to your audience',
            isHt ? 'Respekte Copyright' : 'Respect copyright laws',
          ].map((r, i) => (
            <li key={i}><i className="fas fa-check-circle ca-benefit-icon" aria-hidden="true" />{r}</li>
          ))}
        </ul>
      </div>

      <div className="ca-intro-how-it-works">
        <h4>{isHt ? 'Kijan approval mache' : 'How Approval Works'}</h4>
        <div className="ca-intro-steps">
          {[
            { icon: 'fa-file', en: 'Submit application', ht: 'Voye aplikasyon' },
            { icon: 'fa-clock', en: 'Review (24-72h)', ht: 'Revizyon (24-72h)' },
            { icon: 'fa-check', en: 'Approval notification', ht: 'Notifikasyon apwobasyon' },
            { icon: 'fa-rocket', en: 'Start creating!', ht: 'Kòmanse kreye!' },
          ].map((s, i) => (
            <div key={i} className="ca-intro-how-step">
              <div className="ca-intro-step-num">{i + 1}</div>
              <i className={`fas ${s.icon}`} aria-hidden="true" />
              <span>{isHt ? s.ht : s.en}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ca-intro-cta">
        <button type="button" className="btn-primary ca-intro-start" onClick={onStart}>
          <i className="fas fa-arrow-right" aria-hidden="true" />
          {isHt ? 'Kontinye' : 'Continue'}
        </button>
        <p className="ca-intro-disclaimer">
          {isHt
            ? 'Aplikasyon an pran apeprè 10-15 minit.'
            : 'The application takes about 10-15 minutes.'}
        </p>
      </div>
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════
// STEP WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function StepIndicator({ currentStep, lang }) {
  return (
    <div className="ca-steps" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
      {STEPS_META.map((s, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div
            key={s.id}
            className={`ca-step${isActive ? ' ca-step-active' : ''}${isDone ? ' ca-step-done' : ''}`}
          >
            <span className="ca-step-dot">
              {isDone ? <i className="fas fa-check" /> : stepNum}
            </span>
            <span className="ca-step-label">{lang === 'ht' ? s.labelHt : s.labelEn}</span>
          </div>
        );
      })}
    </div>
  );
}

function StepNav({ currentStep, onNext, onPrev, isSubmitting, lang }) {
  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  // Next is NEVER disabled by validation: clicking it must SHOW which
  // required fields are missing (inline per-field errors below) instead
  // of silently refusing to react.
  return (
    <div className="ca-step-nav">
      {!isFirst && (
        <button type="button" className="btn-secondary" onClick={onPrev} disabled={isSubmitting}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {lang === 'ht' ? 'Anvan' : 'Previous'}
        </button>
      )}
      <button
        type="button"
        className="btn-primary"
        onClick={onNext}
        disabled={isSubmitting}
        style={{ marginLeft: isFirst ? 0 : 'auto' }}
      >
        {isSubmitting ? (
          <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap voye...' : 'Submitting...'}</>
        ) : isLast ? (
          <>{lang === 'ht' ? 'Voye aplikasyon' : 'Submit'} <i className="fas fa-paper-plane" aria-hidden="true" /></>
        ) : (
          <>{lang === 'ht' ? 'Next' : 'Next'} <i className="fas fa-arrow-right" aria-hidden="true" /></>
        )}
      </button>
    </div>
  );
}

function AutosaveIndicator({ lastSaved }) {
  if (!lastSaved) return null;
  return (
    <div className="ca-autosave">
      <i className="fas fa-check-circle ca-autosave-icon" aria-hidden="true" />
      <span>{lastSaved}</span>
    </div>
  );
}

// ─── Field validation ────────────────────────────────────────────────────
// Smart per-field validation. Every required / minimum-length rule below
// has a HUMAN message (ht + en) so when Next / Submit is pressed, the
// wizard can tell the applicant EXACTLY which field is missing and why —
// instead of a generic "fill required fields" with no pointer.

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

function hasText(value) {
  return !!((value || '').toString().trim());
}

function validateStep(step, form, lang) {
  const isHt = lang === 'ht';
  const errs = {};
  const add = (key, ht, en) => { errs[key] = isHt ? ht : en; };
  switch (step) {
    case 1: // Identity
      if (!hasText(form.full_name)) add('full_name', 'Non konplè obligatwa.', 'Full name is required.');
      if (!form.date_of_birth) add('date_of_birth', 'Dat nesans obligatwa.', 'Date of birth is required.');
      if (!hasText(form.identity_type)) add('identity_type', 'Chwazi kalite idantite ou.', 'Select your ID type.');
      break;
    case 2: { // Creator Info
      if (!hasText(form.country)) add('country', 'Chwazi peyi ou.', 'Select your country.');
      const bio = (form.biography || '').trim();
      if (!bio) add('biography', 'Biyografi obligatwa.', 'Biography is required.');
      else if (bio.length < 20) add('biography', isHt ? `Biyografi a dwe gen omwen 20 karaktè (ou gen ${bio.length}).` : `Biography must be at least 20 characters (you have ${bio.length}).`);
      if (!hasText(form.languages)) add('languages', 'Lang obligatwa.', 'Languages are required.');
      const why = (form.why_creator || '').trim();
      if (!why) add('why_creator', 'Champ sa obligatwa.', 'This field is required.');
      else if (why.length < 10) add('why_creator', isHt ? `Ou dwe ekri omwen 10 karaktè (ou gen ${why.length}).` : `Please write at least 10 characters (you have ${why.length}).`);
      break;
    }
    case 3: { // Experience
      if (!hasText(form.experience_years)) add('experience_years', 'Chwazi ane eksperyans ou.', 'Select your years of experience.');
      const ed = (form.experience_description || '').trim();
      if (!ed) add('experience_description', 'Deskripsyon obligatwa.', 'Experience description is required.');
      else if (ed.length < 20) add('experience_description', isHt ? `Deskripsyon an dwe gen omwen 20 karaktè (ou gen ${ed.length}).` : `Description must be at least 20 characters (you have ${ed.length}).`);
      break;
    }
    case 4: // Category
      if (!hasText(form.categories)) add('categories', 'Kategori obligatwa.', 'Categories are required.');
      if (!hasText(form.skills)) add('skills', 'Konpetans obligatwa.', 'Skills are required.');
      break;
    // Step 5 (Portfolio) is fully optional — nothing to validate.
    case 6: { // Social / Contact
      const email = (form.contact_email || '').trim();
      if (!email) add('contact_email', 'Imèl kontak obligatwa.', 'Contact email is required.');
      else if (!isValidEmail(email)) add('contact_email', 'Antre yon adrès imèl ki valid.', 'Enter a valid email address.');
      break;
    }
    case 7: // Terms
      if (!form.terms_accepted) add('terms_accepted', 'Ou dwe aksepte kondisyon itilizasyon yo.', 'Accept the Terms of Service.');
      if (!form.code_of_conduct_accepted) add('code_of_conduct_accepted', 'Ou dwe aksepte kòd kondwit la.', 'Accept the Code of Conduct.');
      if (!form.content_guidelines_accepted) add('content_guidelines_accepted', 'Ou dwe aksepte gid kontni yo.', 'Accept the Content Guidelines.');
      break;
    default: break;
  }
  return errs;
}

function FieldError({ msg, id }) {
  if (!msg) return null;
  return (
    <span id={id} role="alert" className="ca-field-error">
      <i className="fas fa-exclamation-circle" aria-hidden="true" />
      {msg}
    </span>
  );
}

function RequiredLegend({ lang }) {
  return (
    <p className="ca-req-legend">
      <span className="ca-req-star" aria-hidden="true">*</span>
      {lang === 'ht' ? ' = champ obligatwa' : ' = required field'}
    </p>
  );
}

// ─── Step Content Components ──────────────────────────────────────────────

function StepIdentity({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const onEdit = (field) => { clearError?.(field); };
  const invalid = (field) => (err[field] ? ' is-invalid' : '');
  const ari = (field) => (err[field] ? { 'aria-invalid': true, 'aria-describedby': `ca-err-${field}` } : {});
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-id-card ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Idantite' : 'Identity'}</h3>
        <p>{isHt ? 'Kòmanse ak enfòmasyon debaz ou yo.' : 'Start with your basic identity information.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-field-group">
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Non Konplè' : 'Full Name'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('full_name')}`} type="text" value={form.full_name || ''}
            onChange={(e) => { setForm(f => ({ ...f, full_name: e.target.value })); onEdit('full_name'); }}
            placeholder={isHt ? 'Jan Pierre' : 'John Doe'} {...ari('full_name')} />
          <FieldError id="ca-err-full_name" msg={err.full_name} />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Dat Nesans' : 'Date of Birth'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('date_of_birth')}`} type="date" value={form.date_of_birth || ''}
            onChange={(e) => { setForm(f => ({ ...f, date_of_birth: e.target.value })); onEdit('date_of_birth'); }} {...ari('date_of_birth')} />
          <FieldError id="ca-err-date_of_birth" msg={err.date_of_birth} />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Kalite Idantite' : 'ID Type'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <select className={`field-input${invalid('identity_type')}`} value={form.identity_type || ''}
            onChange={(e) => { setForm(f => ({ ...f, identity_type: e.target.value })); onEdit('identity_type'); }} {...ari('identity_type')}>
            {IDENTITY_TYPES.map(o => (
              <option key={o.value} value={o.value}>{isHt ? o.labelHt : o.labelEn}</option>
            ))}
          </select>
          <FieldError id="ca-err-identity_type" msg={err.identity_type} />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Lyen Dokiman ID' : 'ID Document URL'} {isHt ? '(si genyen)' : '(if available)'}</span>
          <input className="field-input" type="url" value={form.identity_document_url || ''}
            onChange={(e) => setForm(f => ({ ...f, identity_document_url: e.target.value }))}
            placeholder="https://drive.google.com/..." />
          <span className="ca-field-hint">{isHt ? 'Ou ka mete yon lyen Google Drive, Dropbox, elatriye.' : 'You can link a Google Drive, Dropbox, etc.'}</span>
        </label>
      </div>
    </div>
  );
}

function StepInfo({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const onEdit = (field) => { clearError?.(field); };
  const invalid = (field) => (err[field] ? ' is-invalid' : '');
  const ari = (field) => (err[field] ? { 'aria-invalid': true, 'aria-describedby': `ca-err-${field}` } : {});
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-user ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Enfòmasyon Kreyatè' : 'Creator Information'}</h3>
        <p>{isHt ? 'Di nou plis sou ou ak sa ou vle fè.' : 'Tell us more about yourself and what you want to do.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-field-group">
        <div className="ca-field-row">
          <label className="ca-field">
            <span className="ca-field-label">{isHt ? 'Peyi' : 'Country'} <span className="ca-req-star" aria-hidden="true">*</span></span>
            <select className={`field-input${invalid('country')}`} value={form.country || ''}
              onChange={(e) => { setForm(f => ({ ...f, country: e.target.value })); onEdit('country'); }} {...ari('country')}>
              {COUNTRY_PRESETS.map(c => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
            </select>
            <FieldError id="ca-err-country" msg={err.country} />
          </label>
          <label className="ca-field">
            <span className="ca-field-label">{isHt ? 'Vil' : 'City'}</span>
            <input className="field-input" type="text" value={form.city || ''}
              onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder={isHt ? 'Pòtoprens' : 'Port-au-Prince'} />
          </label>
        </div>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Biyografi' : 'Biography'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <textarea className={`field-input field-textarea${invalid('biography')}`} value={form.biography || ''}
            onChange={(e) => { setForm(f => ({ ...f, biography: e.target.value })); onEdit('biography'); }}
            placeholder={isHt ? 'Di nou sou ou... Kisa ou anseye? Kisa ou kreye?' : 'Tell us about yourself... What do you teach/create?'}
            rows={4} minLength={20} maxLength={2000} {...ari('biography')} />
          <FieldError id="ca-err-biography" msg={err.biography} />
          <span className="ca-field-counter">{(form.biography || '').length}/2000</span>
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Lang ou pale' : 'Languages'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('languages')}`} type="text" value={form.languages || ''}
            onChange={(e) => { setForm(f => ({ ...f, languages: e.target.value })); onEdit('languages'); }}
            placeholder={isHt ? 'Kreyòl, Fransè, Angle' : 'Haitian Creole, French, English'} {...ari('languages')} />
          <FieldError id="ca-err-languages" msg={err.languages} />
          <span className="ca-field-hint">{isHt ? 'Separe ak vigil' : 'Comma separated'}</span>
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Poukisa ou vle vin kreyatè?' : 'Why become a creator?'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <textarea className={`field-input field-textarea${invalid('why_creator')}`} value={form.why_creator || ''}
            onChange={(e) => { setForm(f => ({ ...f, why_creator: e.target.value })); onEdit('why_creator'); }}
            placeholder={isHt ? 'Kisa ki motive ou? Kisa ou vle reyalize?' : 'What motivates you? What do you want to achieve?'}
            rows={3} minLength={10} maxLength={1000} {...ari('why_creator')} />
          <FieldError id="ca-err-why_creator" msg={err.why_creator} />
        </label>
      </div>
    </div>
  );
}

function StepExperience({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const onEdit = (field) => { clearError?.(field); };
  const invalid = (field) => (err[field] ? ' is-invalid' : '');
  const ari = (field) => (err[field] ? { 'aria-invalid': true, 'aria-describedby': `ca-err-${field}` } : {});
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-briefcase ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Eksperyans' : 'Experience'}</h3>
        <p>{isHt ? 'Pataje eksperyans ou nan domèn ou a.' : 'Share your experience in your field.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-field-group">
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Ane Eksperyans' : 'Years of Experience'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <select className={`field-input${invalid('experience_years')}`} value={form.experience_years || ''}
            onChange={(e) => { setForm(f => ({ ...f, experience_years: e.target.value })); onEdit('experience_years'); }} {...ari('experience_years')}>
            {EXPERIENCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{isHt ? o.labelHt : o.labelEn}</option>
            ))}
          </select>
          <FieldError id="ca-err-experience_years" msg={err.experience_years} />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Deskripsyon Eksperyans' : 'Experience Description'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <textarea className={`field-input field-textarea${invalid('experience_description')}`} value={form.experience_description || ''}
            onChange={(e) => { setForm(f => ({ ...f, experience_description: e.target.value })); onEdit('experience_description'); }}
            placeholder={isHt ? 'Dekri eksperyans ou an detay...' : 'Describe your experience in detail...'}
            rows={4} minLength={20} maxLength={2000} {...ari('experience_description')} />
          <FieldError id="ca-err-experience_description" msg={err.experience_description} />
          <span className="ca-field-counter">{(form.experience_description || '').length}/2000</span>
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Edisyon (si genyen)' : 'Education (if any)'}</span>
          <input className="field-input" type="text" value={form.education || ''}
            onChange={(e) => setForm(f => ({ ...f, education: e.target.value }))}
            placeholder={isHt ? 'Université, Diplôme, Ane' : 'University, Degree, Year'} />
          <span className="ca-field-hint">{isHt ? 'Enstitisyon, Diplòm, Ane — separe ak vigil' : 'Institution, Degree, Year — comma separated'}</span>
        </label>
      </div>
    </div>
  );
}

function StepCategory({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const onEdit = (field) => { clearError?.(field); };
  const invalid = (field) => (err[field] ? ' is-invalid' : '');
  const ari = (field) => (err[field] ? { 'aria-invalid': true, 'aria-describedby': `ca-err-${field}` } : {});
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-tag ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Kategori & Konpetans' : 'Category & Skills'}</h3>
        <p>{isHt ? 'Chwazi domèn ou yo ak konpetans ou genyen.' : 'Choose your domains and skills.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-field-group">
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Kategori' : 'Categories'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('categories')}`} type="text" value={form.categories || ''}
            onChange={(e) => { setForm(f => ({ ...f, categories: e.target.value })); onEdit('categories'); }}
            placeholder={isHt ? 'Kou, Mizik, Devlopman' : 'Courses, Music, Development'} {...ari('categories')} />
          <FieldError id="ca-err-categories" msg={err.categories} />
          <span className="ca-field-hint">{isHt ? 'Separe ak vigil' : 'Comma separated'}</span>
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Konpetans' : 'Skills'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('skills')}`} type="text" value={form.skills || ''}
            onChange={(e) => { setForm(f => ({ ...f, skills: e.target.value })); onEdit('skills'); }}
            placeholder={isHt ? 'JavaScript, Python, Mizik, Design' : 'JavaScript, Python, Music, Design'} {...ari('skills')} />
          <FieldError id="ca-err-skills" msg={err.skills} />
          <span className="ca-field-hint">{isHt ? 'Separe ak vigil' : 'Comma separated'}</span>
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Espesyalite' : 'Specialties'}</span>
          <input className="field-input" type="text" value={form.specialties || ''}
            onChange={(e) => setForm(f => ({ ...f, specialties: e.target.value }))}
            placeholder={isHt ? 'Web Dev, Mizik Kreyòl, Fotografi' : 'Web Dev, Haitian Music, Photography'} />
          <span className="ca-field-hint">{isHt ? 'Ki sa ou pi bon nan?' : 'What are you best at?'}</span>
        </label>
      </div>
    </div>
  );
}

function StepPortfolio({ form, setForm, lang }) {
  const isHt = lang === 'ht';
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-palette ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Pòtfolyo' : 'Portfolio'}</h3>
        <p>{isHt ? 'Montre travay ou yo. Sa bay admin yon lide de sa ou kapab fè.' : 'Showcase your work. This gives admins an idea of your capabilities.'}</p>
      </div>
      <div className="ca-field-group">
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Lyen Pòtfolyo' : 'Portfolio Link'}</span>
          <input className="field-input" type="url" value={form.portfolio_url || ''}
            onChange={(e) => setForm(f => ({ ...f, portfolio_url: e.target.value }))}
            placeholder="https://github.com/yourname" />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Deskripsyon Pòtfolyo' : 'Portfolio Description'}</span>
          <textarea className="field-input field-textarea" value={form.portfolio_description || ''}
            onChange={(e) => setForm(f => ({ ...f, portfolio_description: e.target.value }))}
            placeholder={isHt ? 'Dekri pi bon pwojè ou yo...' : 'Describe your best projects...'}
            rows={3} maxLength={1000} />
        </label>
      </div>
    </div>
  );
}

function StepSocial({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const onEdit = (field) => { clearError?.(field); };
  const invalid = (field) => (err[field] ? ' is-invalid' : '');
  const ari = (field) => (err[field] ? { 'aria-invalid': true, 'aria-describedby': `ca-err-${field}` } : {});
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-share-alt ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Lyen Sosyal' : 'Social Links'}</h3>
        <p>{isHt ? 'Pataje lyen rezo sosyal ou yo.' : 'Share your social media links.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-field-group">
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Sit Wèb' : 'Website'}</span>
          <input className="field-input" type="url" value={form.website_url || ''}
            onChange={(e) => setForm(f => ({ ...f, website_url: e.target.value }))}
            placeholder="https://yourwebsite.com" />
        </label>
        <label className="ca-field">
          <span className="ca-field-label">{isHt ? 'Imèl Kontak' : 'Contact Email'} <span className="ca-req-star" aria-hidden="true">*</span></span>
          <input className={`field-input${invalid('contact_email')}`} type="email" value={form.contact_email || ''}
            onChange={(e) => { setForm(f => ({ ...f, contact_email: e.target.value })); onEdit('contact_email'); }}
            placeholder={isHt ? 'ou@example.com' : 'you@example.com'} {...ari('contact_email')} />
          <FieldError id="ca-err-contact_email" msg={err.contact_email} />
        </label>
        {['twitter', 'github', 'linkedin', 'youtube', 'instagram', 'facebook'].map((platform) => (
          <label key={platform} className="ca-field">
            <span className="ca-field-label">
              <i className={`fab fa-${platform} ca-social-icon`} aria-hidden="true" />
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </span>
            <input className="field-input" type="url"
              value={form[`social_${platform}`] || ''}
              onChange={(e) => setForm(f => ({ ...f, [`social_${platform}`]: e.target.value }))}
              placeholder={`https://${platform}.com/...`} />
          </label>
        ))}
      </div>
    </div>
  );
}

function StepTerms({ form, setForm, lang, errors = {}, clearError }) {
  const isHt = lang === 'ht';
  const err = errors || {};
  const handleCheck = (field) => {
    setForm(f => ({ ...f, [field]: !f[field] }));
    clearError?.(field);
  };
  const invalid = (field) => (err[field] ? ' ca-terms-invalid' : '');
  const TERMS_FIELDS = [
    { key: 'terms_accepted', label: isHt ? 'Kondisyon Itilizasyon' : 'Terms of Service', desc: isHt ? 'Mwen aksepte kondisyon itilizasyon Atelnyo yo.' : 'I accept the Atelnyo Terms of Service.' },
    { key: 'code_of_conduct_accepted', label: isHt ? 'Kòd Kondwit' : 'Code of Conduct', desc: isHt ? 'Mwen angaje m respekte kòd kondwit platfòm nan.' : 'I commit to following the platform code of conduct.' },
    { key: 'content_guidelines_accepted', label: isHt ? 'Gid Kontni' : 'Content Guidelines', desc: isHt ? 'Mwen konprann epi m ap swiv gid kontni yo (pa gen copyright, kontni ofansif, elatriye).' : 'I understand and will follow content guidelines (no copyright, offensive content, etc.).' },
  ];
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-file-contract ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Kondisyon & Règ' : 'Terms & Conditions'}</h3>
        <p>{isHt ? 'Tanpri li epi aksepte kondisyon yo anvan ou kontinye.' : 'Please read and accept the terms before proceeding.'}</p>
        <RequiredLegend lang={lang} />
      </div>
      <div className="ca-terms-list">
        {TERMS_FIELDS.map((item) => (
          <div key={item.key} className="ca-terms-wrap">
            <label className={`ca-terms-item${form[item.key] ? ' ca-terms-checked' : ''}${invalid(item.key)}`}>
              <input type="checkbox" checked={!!form[item.key]}
                aria-invalid={err[item.key] ? true : undefined}
                aria-describedby={err[item.key] ? `ca-err-${item.key}` : undefined}
                onChange={() => handleCheck(item.key)} />
              <span>
                <strong>{item.label}</strong>
                <p>{item.desc}</p>
              </span>
            </label>
            <FieldError id={`ca-err-${item.key}`} msg={err[item.key]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReview({ form, lang }) {
  const isHt = lang === 'ht';
  const sections = [
    { label: isHt ? 'Idantite' : 'Identity', fields: [
      { label: isHt ? 'Non' : 'Name', value: form.full_name },
      { label: isHt ? 'Dat Nesans' : 'DOB', value: form.date_of_birth },
      { label: isHt ? 'ID Type' : 'ID Type', value: form.identity_type },
    ]},
    { label: isHt ? 'Enfòmasyon' : 'Info', fields: [
      { label: isHt ? 'Peyi' : 'Country', value: form.country },
      { label: isHt ? 'Vil' : 'City', value: form.city },
      { label: isHt ? 'Lang' : 'Languages', value: form.languages },
    ]},
    { label: isHt ? 'Eksperyans' : 'Experience', fields: [
      { label: isHt ? 'Ane' : 'Years', value: form.experience_years },
    ]},
    { label: isHt ? 'Kategori' : 'Categories', fields: [
      { label: isHt ? 'Kategori' : 'Categories', value: form.categories },
      { label: isHt ? 'Konpetans' : 'Skills', value: form.skills },
    ]},
    { label: isHt ? 'Kontak' : 'Contact', fields: [
      { label: isHt ? 'Imèl' : 'Email', value: form.contact_email },
      { label: isHt ? 'Sit Wèb' : 'Website', value: form.website_url },
    ]},
  ];
  return (
    <div className="ca-step-content">
      <div className="ca-step-header">
        <i className="fas fa-clipboard-check ca-step-icon" aria-hidden="true" />
        <h3>{isHt ? 'Revize aplikasyon ou' : 'Review Your Application'}</h3>
        <p>{isHt ? 'Tcheke tout enfòmasyon yo anvan ou voye.' : 'Check all information before submitting.'}</p>
      </div>
      <div className="ca-review-sections">
        {sections.map((sec) => (
          <div key={sec.label} className="ca-review-section">
            <h4>{sec.label}</h4>
            {sec.fields.map((f) => (
              <div key={f.label} className="ca-review-field">
                <span className="ca-review-label">{f.label}</span>
                <span className="ca-review-value">{f.value || '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {(!form.terms_accepted || !form.code_of_conduct_accepted) && (
        <p className="ca-terms-required">
          <i className="fas fa-exclamation-circle ca-review-error-icon" aria-hidden="true" />
          {isHt ? 'Ou poko aksepte kondisyon yo. Retounen nan Step 7.' : 'You haven\'t accepted the terms. Go back to Step 7.'}
        </p>
      )}
    </div>
  );
}

function StepSubmit({ form, lang, submitting, onSubmit }) {
  const isHt = lang === 'ht';
  return (
    <div className="ca-step-content ca-step-submit">
      <div className="ca-step-submit-icon">
        <i className="fas fa-paper-plane" aria-hidden="true" />
      </div>
      <h3>{isHt ? 'Pou voye aplikasyon ou!' : 'Ready to Submit!'}</h3>
      <p>{isHt
        ? 'Klike sou bouton an anba a pou voye aplikasyon ou an. N ap revize li epi n ap kontakte w byento.'
        : 'Click the button below to submit your application. We\'ll review it and get back to you soon.'}</p>
      <div className="ca-submit-summary">
        <div className="ca-submit-stat">
          <span className="ca-submit-stat-value">{(form.biography || '').length || 0}</span>
          <span className="ca-submit-stat-label">{isHt ? 'Karaktè Biyografi' : 'Bio Characters'}</span>
        </div>
        <div className="ca-submit-stat">
          <span className="ca-submit-stat-value">{(form.skills || '').split(',').filter(Boolean).length || 0}</span>
          <span className="ca-submit-stat-label">{isHt ? 'Konpetans' : 'Skills'}</span>
        </div>
        <div className="ca-submit-stat">
          <span className="ca-submit-stat-value">{(form.languages || '').split(',').filter(Boolean).length || 0}</span>
          <span className="ca-submit-stat-label">{isHt ? 'Lang' : 'Languages'}</span>
        </div>
      </div>
      <button type="button" className="btn-primary ca-submit-btn" onClick={onSubmit} disabled={submitting}>
        {submitting ? (
          <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap voye...' : 'Submitting...'}</>
        ) : (
          <><i className="fas fa-paper-plane" aria-hidden="true" /> {isHt ? 'Voye aplikasyon' : 'Submit Application'}</>
        )}
      </button>
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════
// STATUS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function StatusDashboard({ app, lang }) {
  const isHt = lang === 'ht';
  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;
  const estimate = ESTIMATED_WAIT[app.status];
  const history = Array.isArray(app.review_timeline) ? app.review_timeline : [];

  return (
    <div className="ca-dashboard">
      {/* Status Hero */}
      <div className="ca-dash-hero" style={{ borderLeftColor: cfg.color }}>
        <div className="ca-dash-hero-icon" style={{ color: cfg.color }}>
          <i className={`fas ${cfg.icon}`} aria-hidden="true" />
        </div>
        <div className="ca-dash-hero-text">
          <h2 className="ca-dash-status">{tVal(lang, cfg)}</h2>
          <p className="ca-dash-hint">{tVal(lang, cfg)}</p>
          {estimate && (
            <span className="ca-dash-estimate">
              <i className="fas fa-clock" aria-hidden="true" />
              {tVal(lang, estimate)}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="ca-dash-stats">
        <div className="ca-dash-stat">
          <span className="ca-dash-stat-value">{app.status}</span>
          <span className="ca-dash-stat-label">{isHt ? 'Estati' : 'Status'}</span>
        </div>
        <div className="ca-dash-stat">
          <span className="ca-dash-stat-value">
            {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '—'}
          </span>
          <span className="ca-dash-stat-label">{isHt ? 'Revize' : 'Reviewed'}</span>
        </div>
        <div className="ca-dash-stat">
          <span className="ca-dash-stat-value">{app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}</span>
          <span className="ca-dash-stat-label">{isHt ? 'Kreye' : 'Created'}</span>
        </div>
      </div>

      {/* Timeline */}
      {history.length > 0 && (
        <div className="ca-dash-timeline">
          <h4>{isHt ? 'Istoryo' : 'Timeline'}</h4>
          {history.map((entry, i) => (
            <div key={i} className="ca-dash-timeline-item">
              <div className="ca-dash-timeline-dot" />
              <div className="ca-dash-timeline-content">
                <strong>{entry.action}</strong>
                <span>{entry.note}</span>
                <small>{entry.at ? new Date(entry.at).toLocaleString() : ''} — {entry.by}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Note */}
      {app.status === 'rejected' && app.review_note && (
        <div className="ca-dash-rejection">
          <i className="fas fa-quote-left" aria-hidden="true" />
          <div>
            <strong>{isHt ? 'Nòt Admin' : 'Admin Note'}</strong>
            <p>{app.review_note}</p>
          </div>
        </div>
      )}

      {/* Need Info message */}
      {app.status === 'need_information' && app.review_note && (
        <div className="ca-dash-need-info">
          <i className="fas fa-circle-info ca-info-need-icon" aria-hidden="true" />
          <div>
            <strong>{isHt ? 'Nou bezwen plis enfòmasyon' : 'We Need More Information'}</strong>
            <p>{app.review_note}</p>
          </div>
        </div>
      )}

      {/* Next Action */}
      {(app.status === 'rejected' || app.status === 'need_information') && (
        <NextAction status={app.status} lang={lang} onAction={() => {}} />
      )}
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CreatorApply({ lang = 'ht', showToast, user, onClose }) {
  const navigate = useSafeNavigate();
  const isHt = lang === 'ht';
  const { loading: gateLoading } = useRoleGate('apply_creator');

  const [wizardStep, setWizardStep] = useState(0); // 0 = intro, 1-9 = steps, 10+ = submitted
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Live per-field errors { fieldKey: localized message } — set when the
  // applicant presses Next/Submit with a missing or invalid field, and
  // cleared per-field as soon as the applicant starts fixing it.
  const [fieldErrors, setFieldErrors] = useState({});
  const [showIntro, setShowIntro] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  // The untouched default form — the first-wins guard for draft
  // restore: a local draft may only be applied while the form is still
  // this exact shape (the server fetch and a server draft both win
  // over the local copy, and so does the user's own typing).
  const [form, setForm] = useState(() => {
    // Legacy localStorage autosave (pre-draftStore) — read-once;
    // ongoing saves go to the draftStore (see below). Kept so a user
    // who drafted before the draftStore migration does not lose work.
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FORM;
  });

  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // ── Draft autosave (POLICY lives here; the draftStore primitive
  //    does the storage) — write every 3 seconds while drafting. The
  //    wizard step rides along in the payload so a restore can drop
  //    the user back on the exact step, not just the data.
  useEffect(() => {
    if (wizardStep >= 1 && wizardStep <= 9) {
      const timer = setInterval(() => {
        saveFormDraft(DRAFT_KEY, { ...form, _step: wizardStep })
          .then((res) => {
            if (res && res.ok) {
              setLastSaved(new Date().toLocaleTimeString());
              // Continuity draft INDEX — the banner can then say
              // "an unsaved draft is saved" on the next relaunch.
              continuityManager.noteDraft(DRAFT_KEY).catch(() => {});
            }
          })
          .catch(() => { /* a failed autosave must never break typing */ });
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [form, wizardStep]);

  // Save on unmount (user leaves page) — using refs to avoid
  // re-running the effect on every render (the cleanup captures
  // the latest values via refs and only fires when the component
  // unmounts, not on every form/wizardStep change).
  const formRef = useRef(form);
  const stepRef = useRef(wizardStep);
  useEffect(() => {
    formRef.current = form;
    stepRef.current = wizardStep;
  }, [form, wizardStep]);
  useEffect(() => {
    return () => {
      const s = stepRef.current;
      if (s >= 1 && s <= 9) {
        saveFormDraft(DRAFT_KEY, { ...formRef.current, _step: s }).catch(() => {});
      }
    };
  }, []);

  // ── Draft RESTORE — a local draft applies ONLY when there is no
  //    server application (a fresh in-progress application) and the
  //    form is still the untouched default (first-wins: the server
  //    fetch, a server draft, or the user's own typing all beat the
  //    local copy). Waits for the fetch to settle (loading → false)
  //    so the server answer is always the tie-breaker.
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (loading || app || draftRestoredRef.current) { return undefined; }
    draftRestoredRef.current = true;
    let alive = true;
    restoreFormDraft(DRAFT_KEY)
      .then((data) => {
        if (!alive) { return; }
        // One-time legacy migration: a pre-draftStore draft still lives
        // in localStorage (the old autosave). Move it into the
        // draftStore — the localStorage key is cleared ONLY after the
        // save SUCCEEDS (if the save fails — e.g. quota, a separate
        // quota from localStorage — the key stays as the only copy and
        // the migration retries next session; a failed save means the
        // draftStore has no fresher draft for the key to shadow).
        if (!data) {
          try {
            const legacy = localStorage.getItem(DRAFT_KEY);
            if (legacy) {
              const parsed = JSON.parse(legacy);
              if (parsed && typeof parsed === 'object') {
                saveFormDraft(DRAFT_KEY, { ...parsed }).then((res) => {
                  if (res && res.ok) { localStorage.removeItem(DRAFT_KEY); }
                }).catch(() => {});
                data = parsed;
              }
            }
          } catch { /* a corrupt legacy draft is discarded, never a gate */ }
        }
        if (!data || typeof data !== 'object') { return; }
        const { _step, ...savedForm } = data;
        // Gate the restore (and the wizard jump) on the CURRENT form:
        // if the user started typing before the async read settled
        // (isDefaultForm false), their in-progress form wins and we do
        // NOT relocate them to a saved step. Read via formRef (the
        // ref that tracks the latest form) — a setForm updater is
        // deferred to the render phase, so the decision must be made
        // HERE, not inside the updater.
        if (isDefaultForm(formRef.current)) {
          setForm({ ...DEFAULT_FORM, ...savedForm });
          // Drop the user back into the wizard on their step (or step
          // 1 when the payload predates the _step field).
          setShowIntro(false);
          setWizardStep(typeof _step === 'number' && _step >= 1 && _step <= 9 ? _step : 1);
        }
      })
      .catch(() => { /* a restore miss is a nicety missed, never a gate */ });
    return () => { alive = false; };
  }, [loading, app]);

  function setFormFromServer(serverApp, setter) {
    setter({
      full_name: serverApp.full_name || '',
      date_of_birth: serverApp.date_of_birth || '',
      identity_type: serverApp.identity_type || '',
      identity_document_url: serverApp.identity_document_url || '',
      country: serverApp.country || 'HT',
      city: serverApp.city || '',
      biography: serverApp.biography || '',
      languages: Array.isArray(serverApp.languages) ? serverApp.languages.join(', ') : (serverApp.languages || ''),
      why_creator: serverApp.why_creator || '',
      experience_years: serverApp.experience_years || '',
      experience_description: serverApp.experience_description || '',
      education: Array.isArray(serverApp.education) ? serverApp.education.map(e => `${e.institution || ''} ${e.degree || ''} ${e.year || ''}`.trim()).join(', ') : (typeof serverApp.education === 'string' ? serverApp.education : ''),
      categories: Array.isArray(serverApp.categories) ? serverApp.categories.join(', ') : (serverApp.categories || ''),
      skills: Array.isArray(serverApp.skills) ? serverApp.skills.join(', ') : (serverApp.skills || ''),
      specialties: Array.isArray(serverApp.specialties) ? serverApp.specialties.join(', ') : (serverApp.specialties || ''),
      portfolio_url: serverApp.portfolio_url || '',
      portfolio_description: serverApp.portfolio_description || '',
      social_twitter: (serverApp.social_links?.twitter) || '',
      social_github: (serverApp.social_links?.github) || '',
      social_linkedin: (serverApp.social_links?.linkedin) || '',
      social_youtube: (serverApp.social_links?.youtube) || '',
      social_instagram: (serverApp.social_links?.instagram) || '',
      social_facebook: (serverApp.social_links?.facebook) || '',
      website_url: serverApp.website_url || '',
      contact_email: serverApp.contact_email || '',
      terms_accepted: serverApp.terms_accepted || false,
      code_of_conduct_accepted: serverApp.code_of_conduct_accepted || false,
      content_guidelines_accepted: serverApp.content_guidelines_accepted || false,
    });
  }
  // Fetch existing application
  useEffect(() => {
    // SetLoading/setError are initialization, not a prop-sync anti-pattern
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    creatorIdentityService.list()
      .then((res) => {
        if (cancelledRef.current) return;
        const items = Array.isArray(res?.data) ? res.data
          : (Array.isArray(res?.data?.results) ? res.data.results : []);
        const mostRecent = items.length > 0 ? items[0] : null;
        setApp(mostRecent);

        if (mostRecent) {
          if (mostRecent.status === 'draft') {
            // Draft: show wizard, restore form from server
            setShowIntro(false);
            setWizardStep(1);
            setFormFromServer(mostRecent, setForm);
          } else if (['submitted', 'under_review', 'need_information'].includes(mostRecent.status)) {
            // Submitted: show status dashboard
            setShowIntro(false);
            setWizardStep(10);
          } else if (mostRecent.status === 'approved' || mostRecent.status === 'suspended') {
            // Approved/suspended: show status dashboard
            setShowIntro(false);
            setWizardStep(10);
          } else if (mostRecent.status === 'rejected') {
            // Rejected: show status dashboard with re-apply option
            setShowIntro(false);
            setWizardStep(10);
          }
        } else {
          // No application yet → show intro
          setShowIntro(true);
          setWizardStep(0);
        }
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        setError(err?.message || 'Could not load your application.');
      })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
  }, []);


  // ─── Smart per-field validation ───────────────────────────────────
  const clearFieldError = useCallback((field) => {
    setFieldErrors(prev => {
      if (!prev || !(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const focusFirstInvalid = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        const el = document.querySelector(
          '.creator-apply-sheet [aria-invalid="true"], .creator-apply-sheet .is-invalid',
        );
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof el.focus === 'function' && el.tagName !== 'LABEL') {
            el.focus({ preventScroll: true });
          }
        }
      } catch (_) { /* a focus nicety must never break the wizard */ }
    });
  }, []);

  const handleNext = useCallback(() => {
    if (wizardStep >= TOTAL_STEPS) return;
    const errs = validateStep(wizardStep, form, lang);
    const count = Object.keys(errs).length;
    if (count > 0) {
      setFieldErrors(errs);
      focusFirstInvalid();
      showToast?.(
        isHt ? `${count} champ obligatwa ki manke pou ka kontinye.` : `${count} required field${count === 1 ? '' : 's'} missing to continue.`,
        'circle-exclamation',
      );
      return;
    }
    setFieldErrors({});
    if (wizardStep < TOTAL_STEPS) {
      setWizardStep(s => s + 1);
    }
  }, [wizardStep, form, lang, isHt, showToast, focusFirstInvalid]);

  const handlePrev = useCallback(() => {
    if (wizardStep > 1) setWizardStep(s => s - 1);
    setFieldErrors({});
  }, [wizardStep]);

  const handleStartWizard = useCallback(() => {
    setShowIntro(false);
    setWizardStep(1);
  }, []);

  function buildPayload(f) {
    return {
      full_name: f.full_name?.trim(),
      date_of_birth: f.date_of_birth || null,
      identity_type: f.identity_type || '',
      identity_document_url: f.identity_document_url?.trim(),
      country: f.country || 'HT',
      city: f.city?.trim(),
      biography: f.biography?.trim(),
      languages: f.languages?.split(',').map(s => s.trim()).filter(Boolean) || [],
      why_creator: f.why_creator?.trim(),
      experience_years: f.experience_years || '',
      experience_description: f.experience_description?.trim(),
      education: f.education?.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ institution: s })) || [],
      categories: f.categories?.split(',').map(s => s.trim()).filter(Boolean) || [],
      skills: f.skills?.split(',').map(s => s.trim()).filter(Boolean) || [],
      specialties: f.specialties?.split(',').map(s => s.trim()).filter(Boolean) || [],
      portfolio_url: f.portfolio_url?.trim(),
      portfolio_description: f.portfolio_description?.trim(),
      social_links: {
        ...(f.social_twitter?.trim() && { twitter: f.social_twitter.trim() }),
        ...(f.social_github?.trim() && { github: f.social_github.trim() }),
        ...(f.social_linkedin?.trim() && { linkedin: f.social_linkedin.trim() }),
        ...(f.social_youtube?.trim() && { youtube: f.social_youtube.trim() }),
        ...(f.social_instagram?.trim() && { instagram: f.social_instagram.trim() }),
        ...(f.social_facebook?.trim() && { facebook: f.social_facebook.trim() }),
      },
      website_url: f.website_url?.trim(),
      contact_email: f.contact_email?.trim(),
      terms_accepted: f.terms_accepted || false,
      code_of_conduct_accepted: f.code_of_conduct_accepted || false,
      content_guidelines_accepted: f.content_guidelines_accepted || false,
    };
  }
  const handleSubmit = useCallback(async () => {
    // Whole-form guard: never submit while ANY required field is missing.
    // Walk steps 1-7 (5 is fully optional), jump back to the first
    // incomplete step and show its inline errors so the applicant knows
    // exactly what to fix before the request leaves the browser.
    for (let step = 1; step <= 7; step += 1) {
      const errs = validateStep(step, form, lang);
      const keys = Object.keys(errs);
      if (keys.length > 0) {
        setWizardStep(step);
        setFieldErrors(errs);
        focusFirstInvalid();
        const total = keys.length;
        showToast?.(
          isHt
            ? `Kanpe: Step ${step} gen ${total} champ obligatwa ki manke.`
            : `Hold on: Step ${step} still has ${total} required field${total === 1 ? '' : 's'} to complete.`,
          'circle-exclamation',
        );
        return;
      }
    }
    setFieldErrors({});
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      let res;
      if (app?.id && (app.status === 'draft' || app.status === 'rejected')) {
        res = await creatorIdentityService.resubmit(app.id, payload);
      } else {
        res = await creatorIdentityService.submit(payload);
      }
      const newApp = res?.data || { ...payload, status: 'submitted' };
      setApp(newApp);
      setWizardStep(10); // show status dashboard
      // Draft CONSUMED — remove it from the draftStore (the DRAFTS
      // domain, which also backs backup/export/clear-data) AND the
      // legacy localStorage key (read-once migration path).
      removeFormDraft(DRAFT_KEY).catch(() => {});
      localStorage.removeItem(DRAFT_KEY);
      showToast?.(
        isHt ? '✨ Aplikasyon ou an rive! N ap revize li byento.' : '✨ Application submitted! We\'ll review it soon.',
        'paper-plane',
      );
    } catch (err) {
      // DRF returns field-level errors as { field: [messages] } or { detail: '...' }.
      const data = err?.response?.data;
      let fieldErr = '';
      if (data?.detail) {
        fieldErr = data.detail;
      } else if (data && typeof data === 'object') {
        // Collect first few validation messages
        const msgs = Object.entries(data)
          .filter(([k]) => k !== 'status')
          .flatMap(([field, errs]) => {
            const list = Array.isArray(errs) ? errs : [String(errs)];
            return list.map(e => `${field}: ${e}`);
          });
        fieldErr = msgs.length > 0
          ? msgs.slice(0, 3).join('\n')
          : (isHt ? 'Erè validasyon.' : 'Validation error.');
      } else {
        fieldErr = err?.message || (isHt ? 'Pa kapab voye aplikasyon.' : 'Could not submit.');
      }
      setError(fieldErr);
      showToast?.(fieldErr, 'circle-exclamation');
    } finally {
      setSubmitting(false);
    }
  }, [form, app, showToast, isHt, focusFirstInvalid]);


  // ─── Gates ──────────────────────────────────────────────────────
  const unlocked = typeof window !== 'undefined' && localStorage.getItem(LS_KEY) === 'true';
  if (gateLoading) {
    return (
      <div className="creator-apply-sheet">
        <CreatorSkeleton rows={6} />
      </div>
    );
  }
  if (!user) return <Navigate to="/sheet/auth" replace />;
  if (!unlocked) return <Navigate to="/" replace />;

  // ─── Render Step Content ─────────────────────────────────────────
  const renderStep = () => {
    switch (wizardStep) {
      case 1: return <StepIdentity form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 2: return <StepInfo form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 3: return <StepExperience form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 4: return <StepCategory form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 5: return <StepPortfolio form={form} setForm={setForm} lang={lang} />;
      case 6: return <StepSocial form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 7: return <StepTerms form={form} setForm={setForm} lang={lang} errors={fieldErrors} clearError={clearFieldError} />;
      case 8: return <StepReview form={form} lang={lang} />;
      case 9: return <StepSubmit form={form} lang={lang} submitting={submitting} onSubmit={handleSubmit} />;
      default: return null;
    }
  };

  return (
    <div className="creator-apply-sheet" data-testid="creator-apply-sheet">
      {/* Header */}
      <div className="creator-apply-header">
        <button type="button" className="icon-btn"
          onClick={() => { onClose ? onClose() : navigate('/'); }}
          aria-label={isHt ? 'Fèmen' : 'Close'}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <h2>
          <i className="fas fa-chalkboard-teacher" aria-hidden="true" />
          {isHt ? 'Vin Kreyatè' : 'Become a Creator'}
        </h2>
      </div>

      <main className="creator-apply-content">
        {loading ? (
          <CreatorSkeleton rows={8} />
        ) : error && !app ? (
          <div className="ca-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <p>{error}</p>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              {isHt ? 'Eseye ankò' : 'Retry'}
            </button>
          </div>
        ) : showIntro ? (
          <IntroductionPage lang={lang} onStart={handleStartWizard} />
        ) : wizardStep >= 1 && wizardStep <= 9 ? (
          <div className="ca-wizard-container">
            <StepIndicator currentStep={wizardStep} lang={lang} />
            <AutosaveIndicator lastSaved={lastSaved} />
            {error && (
              <div className="ca-error-banner">
                <i className="fas fa-circle-exclamation" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {renderStep()}
            <StepNav
              currentStep={wizardStep}
              onNext={wizardStep === TOTAL_STEPS ? handleSubmit : handleNext}
              onPrev={handlePrev}
              isSubmitting={submitting}
              lang={lang}
            />
          </div>
        ) : app && wizardStep >= 10 ? (
          <StatusDashboard app={app} lang={lang} />
        ) : null}
      </main>
    </div>
  );
}
