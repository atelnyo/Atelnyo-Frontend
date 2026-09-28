/**
 * src/components/NotFound.jsx
 *
 * Smart 404 page — detects what the user was looking for from the URL,
 * searches the platform, and shows relevant recommendations to keep
 * them engaged instead of bouncing.
 */
import React, { useState, useEffect, useMemo } from 'react';
import SEOHead from './shared/SEOHead';
import api from '../services/api';

const NOT_FOUND_I18N = {
  en: {
    title: '404 — Page Not Found',
    heading: 'Oops! Page not found.',
    desc: "The page you're looking for doesn't exist or has been moved.",
    searching: 'Searching for content related to your URL...',
    foundTitle: 'Here\'s what we found:',
    noResults: 'No matching content found.',
    tryThese: 'Try these instead:',
    btn: 'Go Home',
    explore: 'Explore All',
  },
  ht: {
    title: '404 — Paj Pa Jwenn',
    heading: 'Oups! Paj sa a pa egziste.',
    desc: 'Li sanble ou pèdi wout ou nan akademi an.',
    searching: 'Ap chèche kontni ki gen rapò ak lyen ou a...',
    foundTitle: 'Sa nou jwenn:',
    noResults: 'Pa gen kontni ki matche.',
    tryThese: 'Eseye sa yo:',
    btn: 'Tounen nan Akèy',
    explore: 'Eksplore Tout',
  },
  fr: {
    title: '404 — Page non trouvée',
    heading: 'Oups! Page non trouvée.',
    desc: "La page que vous cherchez n'existe pas ou a été déplacée.",
    searching: 'Recherche de contenu correspondant...',
    foundTitle: 'Voici ce que nous avons trouvé :',
    noResults: 'Aucun contenu correspondant.',
    tryThese: 'Essayez ceci :',
    btn: "Retour à l'accueil",
    explore: 'Tout explorer',
  },
  es: {
    title: '404 — Página no encontrada',
    heading: '¡Ups! Página no encontrada.',
    desc: 'La página que buscas no existe o ha sido movida.',
    searching: 'Buscando contenido relacionado...',
    foundTitle: 'Esto es lo que encontramos:',
    noResults: 'No se encontró contenido coincidente.',
    tryThese: 'Intenta esto:',
    btn: 'Volver al inicio',
    explore: 'Explorar todo',
  },
};

/**
 * Extract probable search terms from a URL path.
 * E.g. "/javascript-course" → "javascript course"
 *      "/c/johndoe" → "johndoe"
 *      "/sheet/community/react-devs" → "react devs"
 */
function _extractSearchTerms(pathname) {
  if (!pathname) return '';
  let path = pathname.replace(/^\/+/, '');
  // Remove locale prefix like "en-US/", "ht-HT/"
  path = path.replace(/^(en|ht|fr|es)-[A-Z]{2}\//i, '');
  // Remove common prefixes
  path = path.replace(/^(sheet|explore|c|marketplace|page|go)\//i, '');
  // Replace separators with spaces, remove noise words
  const terms = path
    .replace(/[/\-_]+/g, ' ')
    .replace(/\b(of|the|a|an|nan|an|ak|and|ou|or|oswa)\b/gi, '')
    .trim();
  return terms.substring(0, 80);
}

const TYPE_ICONS = {
  course: 'fa-graduation-cap',
  music: 'fa-music',
  talent: 'fa-user',
  community: 'fa-users',
  job: 'fa-briefcase',
  product: 'fa-shopping-bag',
  event: 'fa-calendar',
  spotlight: 'fa-star',
};

const NotFound = ({ onBack, lang = 'en' }) => {
  const t = NOT_FOUND_I18N[lang] || NOT_FOUND_I18N.en;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState([]);

  // Extract search terms from the current URL
  const searchTerms = useMemo(() => _extractSearchTerms(
    typeof window !== 'undefined' ? window.location.pathname : ''
  ), []);

  // Search for matching content + trending fallback
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      // 1. Try to search for content matching the URL terms
      if (searchTerms.length > 2) {
        try {
          const res = await api.get('search/', { params: { q: searchTerms } });
          if (!cancelled && res.data?.results) {
            setResults(res.data.results.slice(0, 6));
          }
        } catch { /* silent */ }
      }

      // 2. Always fetch trending as fallback/recommendation
      try {
        const trendingRes = await api.get('search/trending/', { params: { days: 7, limit: 6 } });
        if (!cancelled && trendingRes.data?.results) {
          setTrending(trendingRes.data.results.slice(0, 6));
        }
      } catch { /* best effort */ }

      if (!cancelled) setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [searchTerms]);

  const handleGoHome = () => {
    if (onBack) onBack();
    else if (typeof window !== 'undefined') window.location.href = '/';
  };

  const handleExplore = () => {
    if (typeof window !== 'undefined') window.location.href = '/explore';
  };

  const displayItems = results.length > 0 ? results : trending;

  return (
    <>
      <SEOHead
        title={t.title}
        description={t.desc}
        noindex={true}
        robots="noindex,nofollow"
      />
      <div className="not-found-page">
        {/* Hero */}
        <div className="nf-hero">
          <h1 className="not-found-code">404</h1>
          <h2 className="not-found-title">{t.heading}</h2>
          <p className="not-found-desc">{t.desc}</p>
        </div>

        {/* Search term detected from URL */}
        {searchTerms && (
          <div className="nf-search-hint">
            <i className="fas fa-search" />
            <span>{t.searching}</span>
            <strong className="nf-search-term">&ldquo;{searchTerms}&rdquo;</strong>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="nf-results">
            <div className="nf-results-grid">
              {[1, 2, 3].map(i => (
                <div key={i} className="nf-card nf-card--skeleton">
                  <div className="nf-card-img-skeleton" />
                  <div className="nf-card-body-skeleton">
                    <div className="nf-card-title-skeleton" />
                    <div className="nf-card-desc-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results / Recommendations */}
        {!loading && displayItems.length > 0 && (
          <div className="nf-results">
            <h3 className="nf-results-title">
              {results.length > 0 ? t.foundTitle : t.tryThese}
            </h3>
            <div className="nf-results-grid">
              {displayItems.map((item, i) => {
                const url = item.url || '/explore';
                const type = item.type || 'course';
                return (
                  <a
                    key={i}
                    href={url}
                    className="nf-card"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={(e) => { e.preventDefault(); window.location.href = url; }}
                  >
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="nf-card-img" loading="lazy" />
                    )}
                    <div className="nf-card-body">
                      <div className="nf-card-type">
                        <i className={`fas ${TYPE_ICONS[type] || 'fa-file'}`} /> {type}
                      </div>
                      <h4 className="nf-card-title">{item.title || item.display_name || 'Content'}</h4>
                      {item.description && (
                        <p className="nf-card-desc">{item.description.substring(0, 100)}</p>
                      )}
                      {item.creator_name && (
                        <span className="nf-card-creator">by {item.creator_name}</span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* No results at all */}
        {!loading && displayItems.length === 0 && (
          <div className="nf-no-results">
            <i className="fas fa-compass nf-no-results-icon" />
            <p>{t.noResults}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="nf-actions">
          <button className="btn-action not-found-btn" onClick={handleGoHome}>
            <i className="fas fa-home" /> {t.btn}
          </button>
          <button className="btn-action not-found-btn not-found-btn--secondary" onClick={handleExplore}>
            <i className="fas fa-compass" /> {t.explore}
          </button>
        </div>
      </div>
    </>
  );
};

export default NotFound;
