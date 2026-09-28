/**
 * SmartRecommendations — Real-data actionable insights (Prompt 23).
 *
 * "No fake content" rule: every recommendation is derived from the
 * data the caller actually passes in. Nothing is invented:
 *   • Reuse cross-module   ← built from real `usages` list per media
 *   • Missing thumbnail    ← media with no thumbnail_url AND is image/video
 *   • Unused media         ← media with reference_count === 0 (and age)
 *   • Broken thumbnail     ← media with health_status === 'broken' or 'expired'
 *   • Heavy usage ≥ 10     ← real reference_count threshold
 *   • Approved but not used
 *
 * If no insights match, renders an honest empty state (no fake
 * suggestions, no fake counts, no Lorem ipsum). Empty state educates
 * the creator: "No insights yet — connect a provider, publish content,
 * or back with real data."
 */
import React, { useMemo } from 'react';
import { moduleLabel } from '../../constants/media';
// ─── Module label resolution lives in ../../constants/media so the
// bilingual vocabulary is shared with MediaList.jsx. ───

const KIND_META = {
  reuse:         { icon: 'fa-recycle',           color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.09))', en: 'Reuse across modules',      ht: 'Reitilize nan modil' },
  missingThumb:  { icon: 'fa-image',             color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))', en: 'Missing thumbnail',         ht: 'Manke thumbnail' },
  unused:        { icon: 'fa-inbox',             color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.09))', en: 'Unused media',              ht: 'Medya pa itilize' },
  broken:        { icon: 'fa-times-circle',      color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))', en: 'Broken media',              ht: 'Medya kase' },
  heavy:         { icon: 'fa-fire',              color: 'var(--pr-color-orange-500, #f97316)', bg: 'var(--pr-color-orange-500-bg, rgba(249,115,22,0.09))', en: 'Heavy usage',               ht: 'Itilizasyon wo' },
  approvedUnused:{ icon: 'fa-medal',             color: 'var(--pr-color-sky-600, #0284c7)', bg: 'rgba(2,132,199,0.09)', en: 'Approved but unused',       ht: 'Apwouve men pa itilize' },
};

function fmtAge(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function buildInsights(media, isHt) {
  const insights = [];

  // ─── 1. Cross-module reuse ─────────────────────────────────
  for (const m of media) {
    const modules = m.usages && Array.isArray(m.usages)
      ? Array.from(new Set(m.usages.map((u) => u.module).filter(Boolean)))
      : [];
    if (modules.length >= 2) {
      insights.push({
        kind: 'reuse',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? `Itilize sou ${modules.length} modil (${modules.map((x) => moduleLabel(x, isHt)).join(', ')})`
          : `Used on ${modules.length} modules (${modules.map((x) => moduleLabel(x, isHt)).join(', ')})`,
        action: isHt ? 'Reitilize sou lòt modil' : 'Reuse on more modules',
      });
    }
  }

  // ─── 2. Missing thumbnail (image + video) ─────────────────
  for (const m of media) {
    const t = (m.media_type || m.kind || '').toLowerCase();
    if ((t === 'image' || t === 'video') && !m.thumbnail_url && !m.preview_url) {
      insights.push({
        kind: 'missingThumb',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? `${t === 'video' ? 'Videyo' : 'Imaj'} sa a pa gen thumbnail — ajoute youn pou amelyore eksperyans.`
          : `This ${t === 'video' ? 'video' : 'image'} has no thumbnail — add one to improve user experience.`,
        action: isHt ? 'Ajoute yon thumbnail' : 'Add a thumbnail',
      });
    }
  }

  // ─── 3. Unused media ──────────────────────────────────────
  for (const m of media) {
    const refs = Number(m.reference_count ?? m.usage_count ?? 0);
    const age = m.created_at ? fmtAge(m.created_at) : '';
    if (refs === 0 && age && age.includes('mo')) {
      insights.push({
        kind: 'unused',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? `Ajoute ${age} pase, poko itilize okenn kote.`
          : `Added ${age}, not used anywhere yet.`,
        action: isHt ? 'Pibliye oswa efase' : 'Publish or delete',
      });
    }
  }

  // ─── 4. Broken / expired ──────────────────────────────────
  for (const m of media) {
    const s = (m.health_status || m.status || '').toLowerCase();
    if (s === 'broken' || s === 'expired' || s === 'blocked') {
      insights.push({
        kind: 'broken',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? `Estati: ${s}. Ranplase URL la oswa re-upload fichye a.`
          : `Status: ${s}. Replace the URL or re-upload the file.`,
        action: isHt ? 'Ranplase' : 'Replace',
      });
    }
  }

  // ─── 5. Heavy usage (≥ 10) ────────────────────────────────
  for (const m of media) {
    const refs = Number(m.reference_count ?? m.usage_count ?? 0);
    if (refs >= 10) {
      insights.push({
        kind: 'heavy',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? `${refs} referans — medya enpòtan.`
          : `${refs} references — important media.`,
        action: isHt ? 'Verifye sante' : 'Verify health',
      });
    }
  }

  // ─── 6. Approved-but-unused ──────────────────────────────
  for (const m of media) {
    const refs = Number(m.reference_count ?? m.usage_count ?? 0);
    const age = m.created_at ? fmtAge(m.created_at) : '';
    if (m.is_approved_publishable && refs === 0 && age && age.includes('mo')) {
      insights.push({
        kind: 'approvedUnused',
        mediaId: m.id || m.media_id,
        title: m.title || m.name || m.url,
        detail: isHt
          ? 'Apwouve pou piblikasyon men pa itilize.'
          : 'Approved for publishing but not used.',
        action: isHt ? 'Pibliye kounye a' : 'Publish now',
      });
    }
  }

  return insights;
}

function InsightRow({ insight, lang, onAction }) {
  const meta = KIND_META[insight.kind] || { icon: 'fa-lightbulb', color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.09))', en: 'Insight', ht: 'Ide' };
  const isHt = lang === 'ht';
  return (
    <li className="smart-rec-row">
      <div className="smart-rec-row-icon" style={{ color: meta.color, background: meta.bg }}>
        <i className={`fas ${meta.icon}`} aria-hidden="true" />
      </div>
      <div className="smart-rec-row-body">
        <div className="smart-rec-row-title" title={insight.title}>{insight.title || '—'}</div>
        <div className="smart-rec-row-detail">{insight.detail}</div>
      </div>
      {onAction && (
        <button
          type="button"
          className="smart-rec-row-action"
          onClick={() => onAction(insight)}
        >
          {insight.action}
          <i className="fas fa-arrow-right" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default function SmartRecommendations({
  media = [],
  maxItems = 8,
  onAction,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';

  const insights = useMemo(() => {
    const built = buildInsights(media, isHt);
    const bySeverity = { broken: 0, missingThumb: 1, unused: 2, approvedUnused: 3, reuse: 4, heavy: 5 };
    built.sort((a, b) => (bySeverity[a.kind] ?? 99) - (bySeverity[b.kind] ?? 99));
    return built.slice(0, maxItems);
  }, [media, isHt, maxItems]);

  return (
    <section className={`smart-recommendations ${className}`} aria-label={isHt ? 'Sijesyon' : 'Recommendations'}>
      <header className="smart-recommendations-header">
        <h3 className="smart-recommendations-title">
          <i className="fas fa-lightbulb" aria-hidden="true" />
          {isHt ? 'Sijesyon' : 'Recommendations'}
        </h3>
        <span className="smart-recommendations-count">
          {insights.length}{' '}
          {isHt ? (insights.length === 1 ? 'ide' : 'ide') : (insights.length === 1 ? 'insight' : 'insights')}
        </span>
      </header>

      {insights.length === 0 ? (
        // ─── Honest empty state (No Fake Content rule) ───
        <div className="smart-recommendations-empty">
          <i className="fas fa-seedling" aria-hidden="true" />
          <h4>{isHt ? 'Pa gen sijesyon kounye a' : 'No insights yet'}</h4>
          <p>
            {isHt
              ? 'N ap analize medya ou yo. Sijesyon parèt lè genyen: medya ki pa itilize, ki kase, ki manke thumbnail, oswa ki ka reitilize sou lòt modil.'
              : 'We analyze your media in real time. Insights appear when there are: unused media, broken media, missing thumbnails, or media that can be reused across modules.'}
          </p>
        </div>
      ) : (
        <ul className="smart-recommendations-list">
          {insights.map((it, i) => (
            <InsightRow key={`${it.kind}-${it.mediaId}-${i}`} insight={it} lang={lang} onAction={onAction} />
          ))}
        </ul>
      )}

      <footer className="smart-recommendations-footer">
        <i className="fas fa-shield-alt" aria-hidden="true" />
        <span>
          {isHt
            ? 'Sijesyon sa yo baze sèlman sou done reyèl medya ou yo. Pa gen envansyon.'
            : 'These recommendations are based only on your real media data. Nothing is invented.'}
        </span>
      </footer>
    </section>
  );
}
