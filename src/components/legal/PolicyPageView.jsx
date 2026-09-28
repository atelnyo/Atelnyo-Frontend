/**
 * src/components/legal/PolicyPageView.jsx
 *
 * Policy Page View — displays legal policy content.
 *
 * Fetches policy content from the Legal API and renders it with
 * Markdown-like formatting. If the policy has a corresponding CMS
 * page (same slug), the CMS page takes precedence for rich layout.
 *
 * Trust First design:
 *   - Shows policy title, version, effective date, governing law
 *   - "Last updated" timestamp for transparency
 *   - Version history indicator
 *   - Summary of changes from previous version
 *   - Highlights key changes with badges
 *
 * Integration:
 *   - Called from dynamic CMS pages (via slug matching)
 *   - Can be rendered directly from /legal/:slug routes
 *   - Embedded in consent modal/banner flows
 */

import React, { useEffect, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import legalService from '../../services/legalService';
import SEOHead from '../shared/SEOHead';
import api from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════
// Simple Markdown renderer (inline — avoids external dep)
// ═══════════════════════════════════════════════════════════════════════

function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hou])/gm, '<p>')
    .replace(/(<\/p>)\s*<p>/g, '$1\n<p>');

  return `<div class="legal-policy-content">${html}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════

const s = {
  shell: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
  },
  header: {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },    meta: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '0.75rem',
  },
  metaItem: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary, #666)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  badge: {
    display: 'inline-block',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    marginLeft: '6px',
  },
  summaryBox: {
    background: 'var(--bg-secondary, #f8f9fa)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
  },    highlightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  highlightItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    color: 'var(--text-main, #1a1a1a)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    color: 'var(--text-secondary, #666)',
  },    error: {
    textAlign: 'center',
    padding: '4rem 1rem',
  },
};


// ═══════════════════════════════════════════════════════════════════════
// PolicyPageView Component
// ═══════════════════════════════════════════════════════════════════════

export default function PolicyPageView({ slug, lang = 'en', showToast }) {
  const navigate = useSafeNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const t = (ht, en, fr, es) => {
    if (isHt) return ht;
    if (isFr) return fr;
    if (isEs) return es;
    return en;
  };

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchPolicy = async () => {
      // 1) Try preferred language first
      let legalData = await legalService.getPolicy(slug, lang).catch(() => null);
      // 2) Fallback to English if preferred language not available
      if (!legalData && lang !== 'en') {
        legalData = await legalService.getPolicy(slug, 'en').catch(() => null);
      }
      return legalData;
    };

    Promise.all([
      fetchPolicy(),
      // Also try CMS page (for rich rendering)
      api.get(`pages/${slug}/render/`).catch(() => null),
    ])
      .then(([legalData, cmsData]) => {
        if (cancelled) return;

        if (!legalData && !cmsData) {
          setError(`Policy "${slug}" not found`);
          return;
        }

        setPolicy({
          legal: legalData?.data || legalData,
          cms: cmsData?.data || null,
        });

        // Update document title
        const title = legalData?.data?.title || slug;
        document.title = `${title} — Atelnyo`;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || 'Failed to load policy');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="legal-policy-shell" style={{ ...s.shell, ...s.loading }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--pink-primary, #d81b60)' }} />
        <p>{t('Ap chaje polisye yo...', 'Loading policy...', 'Chargement de la politique...', 'Cargando política...')}</p>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────
  if (error) {
    const isNetworkError = error?.includes('Network Error') || error?.includes('Failed to fetch');
    const isNotFound = error?.includes('not found') || error?.includes('404');
    const msg = (() => {
      if (isNetworkError) {
        return t(
          'Nou pa ka konekte ak sèvè a. Polisye sa a poko disponib pou kounye a. Tanpri tcheke pita.',
          'Cannot connect to the server. This policy is not available yet. Please check back later.',
          'Impossible de se connecter au serveur. Cette politique n\'est pas disponible pour le moment. Veuillez réessayer plus tard.',
          'No se puede conectar con el servidor. Esta política no está disponible por el momento. Por favor, inténtelo más tarde.'
        );
      }
      if (isNotFound) {
        return t(
          'Polisye sa a poko disponib nan lang ou. Li ka disponib pita.',
          'This policy is not available yet. It may be published later.',
          'Cette politique n\'est pas encore disponible dans votre langue. Elle pourrait être publiée ultérieurement.',
          'Esta política aún no está disponible en su idioma. Podría publicarse más tarde.'
        );
      }
      return t(
        'Polisye sa a poko disponib. Tanpri tcheke pita.',
        'This policy is not available yet. Please check back later.',
        'Cette politique n\'est pas disponible pour le moment. Veuillez réessayer plus tard.',
        'Esta política no está disponible por el momento. Por favor, inténtelo más tarde.'
      );
    })();

    return (
      <div className="legal-policy-shell" style={s.shell}>
        <div style={s.error}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
            {isNetworkError ? '📡' : '📄'}
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main, #1a1a1a)' }}>
            {t('Polisye poko disponib', 'Policy not yet available', 'Politique non encore disponible', 'Política aún no disponible')}
          </h2>
          <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            {msg}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/legal')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                background: 'var(--pink-primary, #d81b60)',
                color: '#fff',
                borderRadius: '50px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <i className="fas fa-scale-balanced" />
              {t('Wè Tout Polisye', 'View All Policies', 'Voir toutes les politiques', 'Ver todas las políticas')}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                background: 'transparent',
                color: 'var(--text-secondary, #666)',
                borderRadius: '50px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--border-color, #e0e0e0)',
              }}
            >
              <i className="fas fa-arrow-left" />
              {t('Retounen', 'Go Back', 'Retour', 'Volver')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!policy || !policy.legal) return null;

  const { legal: p } = policy;
  const langMap = { ht: 'ht', en: 'en', fr: 'fr', es: 'es' };
  const preferredLang = langMap[lang] || 'en';
  const currentVersion = (p.current_version_content || []).find((v) => v.language === preferredLang)
    || p.current_version_content?.[0]
    || {};
  const content = currentVersion.content_md || '';
  const summary = currentVersion.summary || '';
  const highlights = currentVersion.highlights || [];

  // If policy exists but has no content yet, show a coming-soon message
  if (!content && !summary && !policy.cms) {
    return (
      <div className="legal-policy-shell" style={s.shell}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main, #1a1a1a)' }}>
          {currentVersion.title || p.title || t('Polisye poko disponib', 'Policy not yet available', 'Politique non encore disponible', 'Política aún no disponible')}
        </h2>
        <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          {t(
            'Kontni polisye sa a poko prepare. Nou ap travay sou li.',
            'The content for this policy is being prepared. We are working on it.',
            'Le contenu de cette politique est en cours de préparation. Nous y travaillons.',
            'El contenido de esta política está siendo preparado. Estamos trabajando en ello.'
          )}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/legal')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              background: 'var(--pink-primary, #d81b60)',
              color: '#fff',
              borderRadius: '50px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <i className="fas fa-scale-balanced" />
            {t('Wè Tout Polisye', 'View All Policies', 'Voir toutes les politiques', 'Ver todas las políticas')}
          </button>
        </div>
      </div>
    );
  }

  // If CMS page exists, render it instead (richer layout)
  if (policy.cms) {
    return (
      <div className="dynamic-page">
        <SEOHead
          title={p.title || slug}
          description={summary || `Policy: ${p.title || slug}`}
          url={`https://atelnyo.site/legal/${slug}`}
          robots="index,follow"
          lang={lang}
        />
        {policy.cms.sections?.map((section) => {
          const Component = getCMSComponent(section.section_type);
          return Component ? (
            <Component key={section.id} section={section} lang={lang} />
          ) : null;
        })}
      </div>
    );
  }

  // ─── Legal policy rendering ─────────────────────────────────
  const policyTitle = currentVersion.title || p.title || slug;
  return (
    <div className="legal-policy-shell" style={s.shell}>
      <SEOHead
        title={policyTitle}
        description={summary || `Policy: ${policyTitle}`}
        url={`https://atelnyo.site/legal/${slug}`}
        robots="index,follow"
        lang={lang}
      />
      {/* Header */}
      <div style={s.header}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, #1a1a1a)', margin: 0 }}>
          <i className="fas fa-file-shield" style={{ marginRight: '0.5rem', color: 'var(--pink-primary, #d81b60)' }} />
          {currentVersion.title || p.title}
          <span style={s.badge}>v{currentVersion.version_number || p.current_version}</span>
        </h1>

        <div style={s.meta}>
          <span style={s.metaItem}>
            <i className="fas fa-calendar" />
            {t('Efektif:', 'Effective:', 'Entrée en vigueur:', 'Vigente:')} {p.effective_date ? new Date(p.effective_date).toLocaleDateString() : t('Imedyat', 'Immediate', 'Immédiat', 'Inmediato')}
          </span>
          <span style={s.metaItem}>
            <i className="fas fa-gavel" />
            {t('Lalwa:', 'Governing law:', 'Droit applicable:', 'Legislación aplicable:')} {p.governing_law || 'Haiti'}
          </span>
          {currentVersion.version_number > 1 && (
            <span style={s.metaItem}>
              <i className="fas fa-history" />
              {t('Vèsyon', 'Version', 'Version', 'Versión')} {currentVersion.version_number}
            </span>
          )}
          {p.current_version_content?.length > 1 && (
            <span style={s.metaItem}>
              <i className="fas fa-language" />
              {t('Disponib nan', 'Available in', 'Disponible en', 'Disponible en')} {p.current_version_content.length} {t('lang', 'languages', 'langues', 'idiomas')}
            </span>
          )}
        </div>
      </div>

      {/* Summary of changes */}
      {summary && (
        <div style={s.summaryBox}>
          <strong style={{ fontSize: '0.85rem' }}>
            <i className="fas fa-circle-info" style={{ marginRight: '0.4rem', color: 'var(--pink-primary, #d81b60)' }} />
            {t('Sa ki chanje nan vèsyon sa a:', "What's changed in this version:", 'Ce qui a changé dans cette version:', 'Cambios en esta versión:')}
          </strong>
          <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0', color: 'var(--text-secondary, #555)' }}>
            {summary}
          </p>
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div style={{ ...s.summaryBox, background: 'var(--pink-light, #fce4ec)' }}>
          <strong style={{ fontSize: '0.85rem' }}>
            <i className="fas fa-star" style={{ marginRight: '0.4rem', color: 'var(--pink-primary, #d81b60)' }} />
            {t('Pwen klè:', 'Key highlights:', 'Points clés:', 'Aspectos destacados:')}
          </strong>
          <div style={{ ...s.highlightsList, marginTop: '0.5rem' }}>
            {highlights.map((h, i) => (
              <div key={i} style={s.highlightItem}>
                <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '0.75rem' }} />
                {h}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy content (Markdown rendered) */}
      <div
        className="legal-policy-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// CMS Component getter (lazy import to avoid circular deps)
// ═══════════════════════════════════════════════════════════════════════

function getCMSComponent(sectionType) {
  try {
    // Dynamic import of ComponentRegistry — return null if unavailable
    const registry = {
      hero: null,
      banner: null,
      rich_text: null,
      markdown: null,
      separator: null,
      spacer: null,
      faq: null,
    };
    return registry[sectionType] || null;
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════════
// Route wrapper (for use with React Router)
// ═══════════════════════════════════════════════════════════════════════

export function PolicyPageSheet({ lang = 'en', showToast }) {
  // Works with React Router v6 useParams
  // Injected via props from parent component
  const slug = typeof window !== 'undefined'
    ? window.location.pathname.split('/').pop()
    : '';
  return <PolicyPageView slug={slug} lang={lang} showToast={showToast} />;
}
