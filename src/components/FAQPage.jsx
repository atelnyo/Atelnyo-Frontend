/**
 * FAQPage — public-facing FAQ page at /faq.
 *
 * Fetches published FAQ entries from the platform-faqs/public endpoint.
 * No auth required.  Groups entries by category with accordion UX.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../services/api';

export default function FAQPage({ lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const location = useLocation();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}platform-faqs/public/`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(t('Could not load FAQ.', 'Pa t kapab chaje FAQ.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Filter
  const filtered = categories.map((cat) => {
    if (!search.trim()) return cat;
    const q = search.toLowerCase();
    const items = cat.items.filter(
      (item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
    );
    return { ...cat, items };
  }).filter((cat) => cat.items.length > 0);

  const totalQuestions = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="faq-page">
      <Helmet>
        <title>{t('FAQ — Atelnyo', 'FAQ — Atelnyo')}</title>
        <meta name="description" content={t('Frequently asked questions about Atelnyo.', 'Kesyon souvan poze sou Atelnyo.')} />
      </Helmet>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary, #d81b60), var(--pr-color-rose-300, #f06292))',
        color: '#fff', padding: '48px 20px 40px', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 8px' }}>
          <i className="fas fa-question-circle" /> {t('Souvan Poze Kesyon yo', 'Frequently Asked Questions')}
        </h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
          {t(
            `${totalQuestions} kesyon ak repons sou kijan Atelnyo fonksyone.`,
            `${totalQuestions} questions and answers about how Atelnyo works.`,
          )}
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          borderRadius: 12, border: '1px solid var(--border-color)',
          background: 'var(--surface-card, #fff)', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <i className="fas fa-search" style={{ color: 'var(--text-secondary, #888)' }} />
          <input
            type="text" value={search} onChange={(e) => { setSearch(e.target.value); setOpenId(null); }}
            placeholder={t('Chèche yon kesyon...', 'Search a question...')}
            style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1 }}
          />
          {search && (
            <button type="button" onClick={() => { setSearch(''); setOpenId(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
              <i className="fas fa-times" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: 'var(--color-primary, #d81b60)' }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block' }} />
            <p>{error}</p>
            <button type="button" onClick={load} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>
              {t('Eseye ankò', 'Try again')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <i className="fas fa-question-circle" style={{ fontSize: '2rem', marginBottom: 12, display: 'block', opacity: 0.5 }} />
            <p>{search ? t('Pa gen kesyon ki mache.', 'No matching questions.') : t('Pa gen FAQ ankò.', 'No FAQ yet.')}</p>
          </div>
        )}

        {/* Categories */}
        {filtered.map((cat) => (
          <div key={cat.name} style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: '1rem', fontWeight: 700, margin: '0 0 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--text-primary)',
            }}>
              <i className={`fas ${cat.icon || 'fa-folder'}`} style={{ color: 'var(--color-primary, #d81b60)' }} />
              {cat.name}
              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-tertiary)', background: 'var(--bg-highlight, rgba(0,0,0,0.04))', padding: '1px 6px', borderRadius: 99 }}>
                {cat.items.length}
              </span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cat.items.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div key={item.id} style={{
                    borderRadius: 10, border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                    background: 'var(--surface-card, #fff)', overflow: 'hidden',
                    boxShadow: isOpen ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  }}>
                    <button
                      type="button" onClick={() => setOpenId(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 14px', border: 'none', background: 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem',
                        fontWeight: 500, color: 'var(--text-primary)',
                      }}
                    >
                      {item.is_featured && <i className="fas fa-star" style={{ color: '#f59e0b', fontSize: '0.7rem' }} />}
                      <span style={{ flex: 1 }}>{item.question}</span>
                      <i className={`fas fa-chevron-down ${isOpen ? 'fa-rotate-180' : ''}`}
                        style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', transition: 'transform 0.2s' }} />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color-subtle, rgba(0,0,0,0.04))' }}>
                        <p style={{ margin: '12px 0 0', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary, #666)', whiteSpace: 'pre-wrap' }}>
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        {!loading && categories.length > 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0 0', borderTop: '1px solid var(--border-color)', marginTop: 8 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('Pa jwenn sa ou chèche?', "Didn't find what you're looking for?")}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {t('Voye yon mesaj sou platfòm lan!', 'Send a message on the platform!')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
