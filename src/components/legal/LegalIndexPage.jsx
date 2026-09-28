/**
 * src/components/legal/LegalIndexPage.jsx
 *
 * Legal Index Page — lists every published policy on one page so
 * users can find Terms of Service, Privacy, Cookie, Refund, and all
 * other compliance documents from a single hub.
 *
 * Fetches the policy list from the Legal API (public endpoint) and
 * links each row to /legal/<slug> (rendered by PolicyPageView).
 *
 * Trust First design:
 *   - Clean card list with policy title + type label + updated date
 *   - Loading / empty / error states
 *   - Bilingual (ht / en / fr / es) labels where available
 */

import React, { useEffect, useState } from 'react';
import SEOHead from '../shared/SEOHead';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import legalService from '../../services/legalService';

const s = {
  shell: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '2.5rem 1.25rem 4rem',
  },
  header: {
    marginBottom: '1.75rem',
  },
  title: {
    fontSize: '1.9rem',
    fontWeight: 700,
    margin: '0 0 0.4rem',
    color: 'var(--text-primary, #0f172a)',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary, #64748b)',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '0.9rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '1.1rem 1.25rem',
    borderRadius: 14,
    border: '1px solid var(--border-color, rgba(100,116,139,0.18))',
    background: 'var(--surface-2, #ffffff)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
    color: 'inherit',
    textAlign: 'left',
  },
  cardTitle: {
    fontSize: '0.98rem',
    fontWeight: 600,
    color: 'var(--text-primary, #0f172a)',
    margin: 0,
  },
  cardType: {
    fontSize: '0.72rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--pr-color-amber-500, #d81b60)',
  },
  cardMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary, #94a3b8)',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    border: '1px solid var(--border-color, rgba(100,116,139,0.18))',
    background: 'var(--surface-2, #ffffff)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.9rem',
    color: 'var(--text-primary, #0f172a)',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
  },
  chip: {
    padding: '0.3rem 0.8rem',
    borderRadius: 999,
    border: '1px solid var(--border-color, rgba(100,116,139,0.18))',
    background: 'var(--surface-2, #ffffff)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-secondary, #64748b)',
    transition: 'all 0.15s ease',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: 'var(--text-secondary, #64748b)',
  },
  error: {
    textAlign: 'center',
    padding: '3rem 0',
    color: 'var(--danger, #dc2626)',
  },
};

// Map policy type → icon + label key for filtering
const presets = {
  legal:       { icon: 'fa-scale-balanced', labelKey: (t) => t('Legal', 'Legal', 'Légal', 'Legal') },
  privacy:     { icon: 'fa-user-shield', labelKey: (t) => t('Konfidansyalite', 'Privacy', 'Confidentialité', 'Privacidad') },
  terms:       { icon: 'fa-file-signature', labelKey: (t) => t('Kondisyon', 'Terms', 'Conditions', 'Condiciones') },
  payments:    { icon: 'fa-money-bill-wave', labelKey: (t) => t('Peman', 'Payments', 'Paiements', 'Pagos') },
  security:    { icon: 'fa-lock', labelKey: (t) => t('Sekirite', 'Security', 'Sécurité', 'Seguridad') },
  creator:     { icon: 'fa-handshake', labelKey: (t) => t('Kreyatè', 'Creators', 'Créateurs', 'Creadores') },
};

const policyGroupOf = (p) => {
  const type = (p.policy_type || '').toLowerCase();
  const slug = (p.slug || '').toLowerCase();
  if (type.includes('privacy') || slug.includes('privacy') || slug.includes('gdpr') || slug.includes('secret')) return 'privacy';
  if (type.includes('term') || slug.includes('term') || slug.includes('condition')) return 'terms';
  if (slug.includes('refund') || slug.includes('commission') || slug.includes('withdrawal') || slug.includes('payout') || type.includes('payment')) return 'payments';
  if (slug.includes('security')) return 'security';
  if (slug.includes('creator')) return 'creator';
  return 'legal';
};

export default function LegalIndexPage({ lang = 'en' }) {
  const navigate = useSafeNavigate();
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');

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
    let cancelled = false;

    document.title = (isFr ? 'Légal — Atelnyo' : 'Legal — Atelnyo');

    // SEO meta
    const metaDesc = isFr
      ? 'Tous les documents juridiques et de conformité Atelnyo en un seul endroit.'
      : isEs
        ? 'Todos los documentos legales y de cumplimiento de Atelnyo en un solo lugar.'
        : isHt
          ? 'Tout dokiman legal ak konfòmite Atelnyo nan yon sèl kote.'
          : 'All Atelnyo legal and compliance documents in one place.';
    const existingMeta = document.querySelector('meta[name="description"]');
    if (existingMeta) { existingMeta.setAttribute('content', metaDesc); }

    async function loadPolicies() {
      try {
        const res = await legalService.listPolicies({ lang });
        if (cancelled) { return; }
        const data = res?.data;
        const list = Array.isArray(data) ? data : (data?.results || []);
        setPolicies(list);
      } catch {
        if (!cancelled) { setError(true); }
      }
    }
    loadPolicies();

    return () => { cancelled = true; };
  }, [isFr]);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(
        lang === 'ht' ? 'fr' : (lang === 'fr' ? 'fr-FR' : (lang === 'es' ? 'es-ES' : 'en-US')),
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch {
      return '';
    }
  };

  // ─── Filtering ─────────────────────────────────────────────────
  const groupKeys = ['privacy', 'terms', 'payments', 'security', 'creator', 'legal'];
  const filtered = (policies || []).filter((p) => {
    if (group !== 'all' && policyGroupOf(p) !== group) return false;
    if (query) {
      const hay = `${p.title || ''} ${p.description || ''} ${p.policy_type || ''} ${p.slug || ''}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  // ─── Loading ───────────────────────────────────────────────────
  if (policies === null && !error) {
    return (
      <div style={{ ...s.shell, ...s.loading }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--pink-primary, #d81b60)' }} />
        <p style={{ marginTop: '0.75rem' }}>
          {t('Ap chaje politik yo...', 'Loading policies...', 'Chargement des politiques...', 'Cargando políticas...')}
        </p>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ ...s.shell, ...s.error }}>
        <i className="fas fa-circle-exclamation" style={{ fontSize: '1.5rem' }} />
        <p style={{ marginTop: '0.75rem' }}>
          {t(
            'Pa kapab chaje politik yo. Eseye ankò pita.',
            'Unable to load policies. Please try again later.',
            'Impossible de charger les politiques. Réessayez plus tard.',
            'No se pudieron cargar las políticas. Inténtelo más tarde.',
          )}
        </p>
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────────
  if (!policies || policies.length === 0) {
    return (
      <div style={{ ...s.shell, ...s.loading }}>
        <i className="fas fa-scroll" style={{ fontSize: '1.5rem' }} />
        <p style={{ marginTop: '0.75rem' }}>
          {t('Poko gen politik pibliye.', 'No published policies yet.', 'Aucune politique publiée.', 'Aún no hay políticas publicadas.')}
        </p>
      </div>
    );
  }

  // ─── List ──────────────────────────────────────────────────────
  return (
    <div style={s.shell}>
      <SEOHead
        title="Legal"
        description={t(
          'Tout dokiman legal ak konfòmite Atelnyo nan yon sèl kote.',
          'All Atelnyo legal and compliance documents in one place.',
          'Tous les documents juridiques et de conformité Atelnyo en un seul endroit.',
          'Todos los documentos legales y de cumplimiento de Atelnyo en un solo lugar.',
        )}
        url="https://atelnyo.site/legal"
        robots="index,follow"
        lang={lang}
      />
      <div style={s.header}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748b)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '1rem', padding: 0 }}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" /> {t('Retounen', 'Back', 'Retour', 'Volver')}
        </button>
        <h1 style={s.title}>
          {t('Legal', 'Legal', 'Légal', 'Legal')}
        </h1>
        <p style={s.subtitle}>
          {t(
            'Tout dokiman legal ak konfòmite Atelnyo nan yon sèl kote.',
            'All Atelnyo legal and compliance documents in one place.',
            'Tous les documents juridiques et de conformité Atelnyo en un seul endroit.',
            'Todos los documentos legales y de cumplimiento de Atelnyo en un solo lugar.',
          )}
        </p>
      </div>

      <div style={s.controls}>
        <div style={s.searchBox}>
          <i className="fas fa-magnifying-glass" style={{ color: 'var(--text-tertiary, #94a3b8)' }} aria-hidden="true" />
          <input
            type="search"
            style={s.searchInput}
            placeholder={t('Chèche yon politik...', 'Search policies...', 'Rechercher une politique...', 'Buscar una política...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('Chèche yon politik', 'Search policies', 'Rechercher une politique', 'Buscar una política')}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary, #94a3b8)', fontSize: '0.9rem' }}
              aria-label={t('Netwaye rechèch', 'Clear search', 'Effacer la recherche', 'Limpiar búsqueda')}
            >
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <div style={s.chips}>
          <button
            type="button"
            style={{ ...s.chip, ...(group === 'all' ? { background: 'var(--pink-primary, #d81b60)', color: '#fff', borderColor: 'var(--pink-primary, #d81b60)' } : {}) }}
            onClick={() => setGroup('all')}
          >
            {t('Tout', 'All', 'Tout', 'Todos')}
          </button>
          {groupKeys.map((key) => (
            <button
              key={key}
              type="button"
              style={{ ...s.chip, ...(group === key ? { background: 'var(--pink-primary, #d81b60)', color: '#fff', borderColor: 'var(--pink-primary, #d81b60)' } : {}) }}
              onClick={() => setGroup(group === key ? 'all' : key)}
            >
              <i className={`fas ${presets[key].icon}`} style={{ marginRight: 4 }} aria-hidden="true" /> {presets[key].labelKey(t)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={s.loading}>
          <i className="fas fa-filter" style={{ fontSize: '1.5rem', color: 'var(--text-tertiary, #94a3b8)' }} />
          <p style={{ marginTop: '0.75rem' }}>
            {t('Pa gen rezilta.', 'No results found.', 'Aucun résultat.', 'No se encontraron resultados.')}
          </p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((p) => {
            const grp = presets[policyGroupOf(p)] || presets.legal;
            return (
              <button
                key={p.slug || p.id}
                type="button"
                style={s.card}
                onClick={() => navigate(`/legal/${p.slug}`)}
                aria-label={p.title}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--pink-primary, #d81b60)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, rgba(100,116,139,0.18))'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={s.cardType}>
                  <i className={`fas ${grp.icon}`} aria-hidden="true" /> {p.policy_type_label || p.policy_type}
                </span>
                <h3 style={s.cardTitle}>{p.title}</h3>
                {p.updated_at && (
                  <span style={s.cardMeta}>
                    {t('Mizajou', 'Updated', 'Mise à jour', 'Actualizado')}: {formatDate(p.updated_at)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
