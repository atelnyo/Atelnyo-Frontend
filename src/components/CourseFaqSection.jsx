/**
 * src/components/CourseFaqSection.jsx
 *
 * Learner-facing FAQ section for the course detail page.
 * Fetches PUBLIC & PUBLISHED FAQ from the course-specific FAQ backend
 * (CourseFAQ model + /api/course-faqs/public/). Falls back to the
 * platform-wide static FAQ when the course has no creator-managed FAQ.
 *
 * Emits FAQPage JSON-LD structured data for Google rich results
 * when course-specific FAQ exists (spec §15).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { courseFaqService } from '../services/api';
import { faqPageSchema } from './shared/SEOHead';
import FAQ from './FAQ';

export default function CourseFaqSection({ courseId, lang = 'ht', translations }) {
  const isHt = lang === 'ht';
  const [faqs, setFaqs] = useState(null); // null = loading, [] = no FAQ
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) {
      setFaqs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    courseFaqService.public(courseId)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setFaqs(list);
      })
      .catch(() => {
        if (!cancelled) setFaqs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!faqs || faqs.length === 0) return [];
    if (!search.trim()) return faqs;
    const q = search.toLowerCase();
    return faqs.filter((f) =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [faqs, search]);

  // Group by category
  const grouped = useMemo(() => {
    if (filtered.length === 0) return [];
    const groups = new Map();
    filtered.forEach((faq) => {
      const catName = faq.category_name || (isHt ? 'Lòt' : 'Other');
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName).push(faq);
    });
    return Array.from(groups.entries());
  }, [filtered, isHt]);

  // FAQPage JSON-LD structured data for Google rich results (spec §15)
  // Only PUBLIC FAQ qualifies — never expose private/enrolled FAQ in metadata.
  const schemaData = useMemo(() => faqPageSchema(faqs), [faqs]);

  const toggleFaq = useCallback((index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="faq-accordion">
        <h2 className="faq-accordion-title">
          <i className="fas fa-question-circle" aria-hidden="true" />
          {' '}FAQ
        </h2>
        <div style={{ padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          {' '}{isHt ? 'Chaje FAQ...' : 'Loading FAQ...'}
        </div>
      </div>
    );
  }

  // No course-specific FAQ — fall back to platform-wide static FAQ
  if (faqs === null || faqs.length === 0) {
    return <FAQ lang={lang} translations={translations} courseId={courseId} />;
  }

  return (
    <div className="faq-accordion" data-testid="course-faq-section">
      <h2 className="faq-accordion-title">
        <i className="fas fa-question-circle" aria-hidden="true" />
        {' '}FAQ
      </h2>

      {/* Search bar (only shown when there are enough FAQ items) */}
      {faqs.length >= 5 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 16,
          borderRadius: 10, border: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}>
          <i className="fas fa-search" aria-hidden="true" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenIndex(null); }}
            placeholder={isHt ? 'Chèche nan FAQ...' : 'Search FAQ...'}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '0.9rem', width: '100%',
            }}
            aria-label={isHt ? 'Chèche nan FAQ' : 'Search FAQ'}
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setOpenIndex(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              aria-label={isHt ? 'Efase chèch' : 'Clear search'}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* No results */}
      {search && filtered.length === 0 && (
        <p style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
          {isHt ? 'Pa gen FAQ ki mache ak chèch ou.' : 'No FAQ matches your search.'}
        </p>
      )}

      {/* FAQ items grouped by category */}
      {grouped.map(([catName, items]) => (
        <div key={catName} style={{ marginBottom: grouped.length > 1 ? 20 : 0 }}>
          {grouped.length > 1 && (
            <h3 style={{
              fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)',
              margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {catName}
            </h3>
          )}
          <div className="faq-accordion-list">
            {items.map((faq) => {
              const globalIdx = faqs.indexOf(faq);
              const isOpen = openIndex === globalIdx;
              return (
                <div
                  key={faq.id}
                  className={`faq-accordion-item ${isOpen ? 'faq-accordion-item--open' : ''}`}
                >
                  <button
                    type="button"
                    className="faq-accordion-trigger"
                    onClick={() => toggleFaq(globalIdx)}
                    aria-expanded={isOpen}
                    aria-controls={`course-faq-panel-${faq.id}`}
                  >
                    <span className="faq-accordion-question">{faq.question}</span>
                    <i
                      className={`fas fa-chevron-down faq-accordion-icon ${isOpen ? 'faq-accordion-icon--open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id={`course-faq-panel-${faq.id}`}
                    className={`faq-accordion-collapse ${isOpen ? 'faq-accordion-collapse--open' : ''}`}
                    role="region"
                    aria-hidden={!isOpen}
                  >
                    <div className="faq-accordion-content">
                      <p className="faq-accordion-answer" style={{ whiteSpace: 'pre-wrap' }}>
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* FAQPage JSON-LD structured data for Google rich results (spec §15).
          Only PUBLIC FAQ qualifies — private/enrolled FAQ is never in metadata.
          Rendered as a sibling, not inside the accordion, so search engines
          parse it independently from the visible UI. */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            ...schemaData,
          })}
        </script>
      )}
    </div>
  );
}
