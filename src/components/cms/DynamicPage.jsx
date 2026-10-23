/**
 * src/components/cms/DynamicPage.jsx
 *
 * DynamicPage — rann yon paj dinamik soti nan CMS la.
 *
 * Itilizasyon:
 *   <DynamicPage slug="about" lang="ht" />
 *
 * Li chaje paj la nan `/api/pages/<slug>/render/` epi li rann
 * chak seksyon atravè ComponentRegistry la.
 */
import React, { useEffect, useState } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { useParams } from 'react-router-dom';
import { getComponentForSection } from './ComponentRegistry';
import api from '../../services/api';
import SEOHead from '../shared/SEOHead';

const styles = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '4rem 1rem', color: 'var(--text-secondary)',
  },
  error: { textAlign: 'center', padding: '4rem 1rem' },
  errorTitle: { fontSize: '1.5rem', fontWeight: 600, color: 'var(--pink-primary, #d81b60)', marginBottom: '0.5rem' },
  errorDesc: { color: 'var(--text-secondary)', marginBottom: '1.5rem' },
  backBtn: {
    display: 'inline-block', padding: '10px 24px',
    background: 'var(--pink-primary, #d81b60)', color: 'var(--on-primary, #fff)',
    borderRadius: '50px', fontWeight: 600, cursor: 'pointer', border: 'none',
  },
};

// Loading watchdog — a slow/hung API response must never leave the page
// spinning forever. The axios client's own timeout is 45s (Render cold
// starts), far too long for a public info page to sit on a spinner, so
// these pages race their own shorter deadline and show a retry-able
// error instead.
const PAGE_FETCH_TIMEOUT_MS = 12_000;

export default function DynamicPage({ slug, lang = 'ht', showToast }) {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useSafeNavigate();

  // ─── ALL hooks before any early return ───────────────────────
  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageData(null);

    // Watchdog: force the error state if the API hasn't answered in time.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      cancelled = true; // ignore the late response entirely
      setError('The server is taking too long to respond. Please try again in a moment.');
      setLoading(false);
    }, PAGE_FETCH_TIMEOUT_MS);

    api.get(`/pages/${slug}/render/`)
      .then((res) => {
        if (cancelled) return;
        setPageData(res.data);
        // Update document title from page meta
        const meta = res.data?.meta;
        if (meta?.title) document.title = meta.title;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setError(`Page "${slug}" not found`);
        } else {
          setError(err?.response?.data?.error || err.message || 'Failed to load page');
        }
      })
      .finally(() => {
        clearTimeout(watchdog);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [slug]);

  // ─── Early returns (safe — hooks are all above) ──────────────
  if (!slug) {
    return (
      <div style={styles.error}>
        <p style={styles.errorDesc}>No page slug specified.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }} />
        Loading page...
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.error}>
        <div style={styles.errorTitle}>
          <i className="fas fa-triangle-exclamation" style={{ marginRight: '0.5rem' }} />
          Page Not Found
        </div>
        <p style={styles.errorDesc}>{error}</p>
        <button style={styles.backBtn} onClick={() => navigate('/')}>
          <i className="fas fa-arrow-left" style={{ marginRight: '0.5rem' }} />
          Return Home
        </button>
      </div>
    );
  }

  if (!pageData) return null;

  // ─── Render sections ─────────────────────────────────────────
  const meta = pageData?.meta || {};
  return (
    <div className="dynamic-page" data-template={pageData.template}>
      <SEOHead
        title={meta?.title || pageData.title || slug}
        description={meta?.description || meta?.excerpt || ''}
        image={meta?.image || meta?.og_image}
        noindex={meta?.noindex || false}
      />
      {pageData.sections.map((section) => {
        const Component = getComponentForSection(section.section_type);
        return (
          <Component
            key={section.id || section.section_type + section.order}
            section={section}
            lang={lang}
            showToast={showToast}
          />
        );
      })}
    </div>
  );
}

/**
 * DynamicPageSheet — pou itilize kòm yon sheet route.
 *
 * Itilizasyon nan App.jsx:
 *   <Route path="/sheet/page/:slug" element={<DynamicPageSheet lang={lang} showToast={showToast} />} />
 * (Ansyen /page/:slug redirecte nan fòm sa a — T093.)
 */
export function DynamicPageSheet({ lang = 'ht', showToast }) {
  // Sèvi ak useParams() olye de window.location (bon pou React Router)
  const { slug } = useParams();
  return <DynamicPage slug={slug} lang={lang} showToast={showToast} />;
}
