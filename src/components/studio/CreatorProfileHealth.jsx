/**
 * src/components/studio/CreatorProfileHealth.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROMPT 22 — Profile Health & Completeness Dashboard
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Shows:
 *   • Health Score ring (0-100) with tier badge (Excellent/Good/Fair/Needs Work/Poor)
 *   • 8-factor breakdown bars (completeness, professionalism, consistency, etc.)
 *   • Completeness checklist — what's done vs. what's missing
 *   • Featured content pinning (set which course/product/portfolio shows first)
 *
 * States: loading, error, has data, no profile (empty).
 * Everything from real API data.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { creatorProfileHealthService, courseService, marketplaceService, portfolioService } from '../../services/api';

const TIER_LABELS = {
  excellent: { en: 'Excellent', ht: 'Ekselan' },
  good: { en: 'Good', ht: 'Bon' },
  fair: { en: 'Fair', ht: 'Mwayen' },
  needs_work: { en: 'Needs Work', ht: 'Bezwen Travay' },
  poor: { en: 'Poor', ht: 'Fèb' },
};

function classNames(...parts) { return parts.filter(Boolean).join(' '); }

export default function CreatorProfileHealth({ lang = 'en', showToast, user }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // For pinning dropdowns
  const [courses, setCourses] = useState([]);
  const [products, setProducts] = useState([]);
  const [portfolios, setPortfolios] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, coursesRes, productsRes, portsRes] = await Promise.allSettled([
        creatorProfileHealthService.get(),
        courseService.getAll(),
        marketplaceService.list({ limit: 20 }),
        portfolioService.list({ limit: 20 }),
      ]);
      setData(healthRes.status === 'fulfilled' ? healthRes.value.data : null);
      const normArray = (d) => Array.isArray(d) ? d : [];
      setCourses(normArray(coursesRes.value?.data));
      setProducts(normArray(productsRes.value?.data?.results || productsRes.value?.data));
      setPortfolios(normArray(portsRes.value?.data?.results || portsRes.value?.data));
    } catch (err) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData is stable [] callback
  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePin = async (field, value) => {
    setPinSubmitting(true);
    try {
      const payload = {};
      payload[field] = value || null;
      await creatorProfileHealthService.pin(payload);
      showToast?.(isHt ? 'Ansekle aktyalize!' : 'Pin updated!', 'check-circle');
      // Update local state only — no need to refetch everything
      setData((prev) => prev ? {
        ...prev,
        featured_pins: { ...prev.featured_pins, [field]: value || null },
      } : prev);
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    } finally {
      setPinSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="cph-loading" role="status" aria-busy="true">
        <div className="cph-skel-row" />
        <div className="cph-skel-row" style={{ width: '60%' }} />
        <div className="cph-skel-row" style={{ width: '80%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cph-error" role="alert">
        <i className="fas fa-triangle-exclamation" />
        <span>{isHt ? 'Pa ka chaje sante pwofil' : 'Cannot load profile health'}</span>
        <button type="button" className="cph-retry-btn" onClick={fetchData}>
          <i className="fas fa-rotate" /> {isHt ? 'Reye' : 'Retry'}
        </button>
      </div>
    );
  }

  // Backend returns profile_exists: false when profile is not created yet
  if (data && data.profile_exists === false) {
    return (
      <div className="cph-empty" role="status">
        <div className="cph-empty-icon">
          <i className="fas fa-user-plus" style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        </div>
        <span>{isHt ? 'Kreye pwofil piblik ou an premye nan seksyon "Pwofil Piblik".' : 'Create your public profile first in the "Public Profile" section.'}</span>
        <button type="button" className="cph-retry-btn" onClick={fetchData}>
          <i className="fas fa-rotate" /> {isHt ? 'Verifye' : 'Check again'}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cph-error" role="alert">
        <i className="fas fa-triangle-exclamation" />
        <span>{isHt ? 'Pa ka chaje sante pwofil' : 'Cannot load profile health'}</span>
        <button type="button" className="cph-retry-btn" onClick={fetchData}>
          <i className="fas fa-rotate" /> {isHt ? 'Reye' : 'Retry'}
        </button>
      </div>
    );
  }

  const { completeness, health, featured_pins } = data;
  const tierInfo = TIER_LABELS[health?.tier] || TIER_LABELS.fair;

  return (
    <div className="cph-container">
      {/* ─── Health Score Header ─────────────────────────────── */}
      <div className="cph-header">
        <div className="cph-score-ring" style={{ '--score-pct': `${health?.score || 0}%`, '--score-color': health?.tier_color || '#94a3b8' }}>
          <svg viewBox="0 0 120 120" className="cph-ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color, #e2e8f0)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke={health?.tier_color || '#94a3b8'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(health?.score || 0) * 3.267}, 327`}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
            <text x="60" y="56" textAnchor="middle" className="cph-ring-value">
              {health?.score || 0}
            </text>
            <text x="60" y="75" textAnchor="middle" className="cph-ring-label">
              {isHt ? 'Sante' : 'Health'}
            </text>
          </svg>
        </div>
        <div className="cph-header-info">
          <h3 className="cph-title">
            <i className="fas fa-heart-pulse" style={{ color: health?.tier_color }} aria-hidden="true" />
            {isHt ? 'Sante Pwofil' : 'Profile Health'}
          </h3>
          <span
            className="cph-tier-badge"
            style={{ background: health?.tier_color || '#94a3b8', color: '#fff' }}
          >
            {isHt ? tierInfo.ht : tierInfo.en}
          </span>
          <p className="cph-tier-desc">
            {isHt ? `${completeness?.checks_passed || 0}/${completeness?.checks_total || 0} chèk pase` : `${completeness?.checks_passed || 0}/${completeness?.checks_total || 0} checks passed`}
          </p>
        </div>
      </div>

      {/* ─── Completeness Checklist ──────────────────────────── */}
      <section className="cph-section">
        <h4 className="cph-section-title">
          <i className="fas fa-clipboard-list" aria-hidden="true" />
          {isHt ? 'Konple Pwofil' : 'Profile Completeness'} — {completeness?.score || 0}%
        </h4>
        <div className="cph-progress-bar">
          <div className="cph-progress-fill" style={{ width: `${completeness?.score || 0}%` }} />
        </div>

        {/* Missing items */}
        {completeness?.missing?.length > 0 && (
          <div className="cph-checklist">
            <span className="cph-checklist-label" style={{ color: '#ef4444' }}>
              <i className="fas fa-circle-exclamation" /> {isHt ? 'Sa ki manke:' : 'Missing:'}
            </span>
            <div className="cph-checklist-items">
              {completeness.missing.map((item) => (
                <div key={item.key} className="cph-checklist-item cph-missing">
                  <i className="fas fa-circle" style={{ fontSize: '0.35rem', color: '#ef4444' }} />
                  <span>{isHt ? item.label_ht : item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed items */}
        {completeness?.complete?.length > 0 && (
          <details className="cph-checklist-done">
            <summary className="cph-checklist-label" style={{ color: '#10b981', cursor: 'pointer' }}>
              <i className="fas fa-circle-check" /> {isHt ? `${completeness.complete.length} Fini:` : `${completeness.complete.length} Complete:`}
            </summary>
            <div className="cph-checklist-items">
              {completeness.complete.map((item) => (
                <div key={item.key} className="cph-checklist-item cph-done">
                  <i className="fas fa-check" style={{ color: '#10b981', fontSize: '0.5rem' }} />
                  <span>{isHt ? item.label_ht : item.label}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ─── 8-Factor Breakdown ───────────────────────────────── */}
      <section className="cph-section">
        <h4 className="cph-section-title">
          <i className="fas fa-chart-simple" aria-hidden="true" />
          {isHt ? 'Faktè Sante' : 'Health Factors'}
        </h4>
        <div className="cph-factors">
          {Object.entries(health?.factors || {}).map(([key, factor]) => (
            <div key={key} className="cph-factor">
              <div className="cph-factor-top">
                <span className="cph-factor-label">{isHt ? factor.label_ht : factor.label}</span>
                <span className="cph-factor-weight">{factor.weight}%</span>
              </div>
              <div className="cph-factor-bar">
                <div className="cph-factor-fill" style={{ width: `${factor.score}%` }} />
              </div>
              <span className="cph-factor-value">{factor.score}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Featured Content Pinning ─────────────────────────── */}
      <section className="cph-section">
        <h4 className="cph-section-title">
          <i className="fas fa-thumbtack" aria-hidden="true" />
          {isHt ? 'Kontni An vedèt' : 'Featured Content'}
        </h4>
        <p className="cph-section-sub">
          {isHt ? 'Chwazi ki kontni ki parèt premye sou pwofil piblik ou.' : 'Choose which content shows first on your public profile.'}
        </p>

        <div className="cph-pins">
          {/* Featured Course */}
          <div className="cph-pin-field">
            <label className="cph-pin-label">
              <i className="fas fa-graduation-cap" /> {isHt ? 'Kou An vedèt' : 'Featured Course'}
            </label>
            <select
              className="cph-pin-select"
              value={featured_pins?.featured_course_id || ''}
              onChange={(e) => handlePin('featured_course_id', e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={pinSubmitting}
            >
              <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
              {Array.isArray(courses) && courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Featured Product */}
          <div className="cph-pin-field">
            <label className="cph-pin-label">
              <i className="fas fa-cube" /> {isHt ? 'Pwodwi An vedèt' : 'Featured Product'}
            </label>
            <select
              className="cph-pin-select"
              value={featured_pins?.featured_product_id || ''}
              onChange={(e) => handlePin('featured_product_id', e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={pinSubmitting}
            >
              <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
              {Array.isArray(products) && products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Featured Portfolio */}
          <div className="cph-pin-field">
            <label className="cph-pin-label">
              <i className="fas fa-briefcase" /> {isHt ? 'Pòtfolyo An vedèt' : 'Featured Portfolio'}
            </label>
            <select
              className="cph-pin-select"
              value={featured_pins?.featured_portfolio_id || ''}
              onChange={(e) => handlePin('featured_portfolio_id', e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={pinSubmitting}
            >
              <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
              {Array.isArray(portfolios) && portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
