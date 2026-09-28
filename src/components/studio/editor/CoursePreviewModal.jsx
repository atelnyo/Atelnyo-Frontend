/**
 * src/components/studio/editor/CoursePreviewModal.jsx
 *
 * "View as Learner" — a LIVE preview of the course exactly as the
 * editor has it right now (unsaved changes included, no enrollment
 * required). Renders the REAL learner block components through
 * BlockRenderer so what the creator previews is what learners get:
 * module → lesson → block → practice.
 *
 * Quiz/assignment blocks degrade gracefully: courseId is null, so
 * they never write real quiz attempts or submissions from a preview.
 */
import React, { useState } from 'react';
import { BlockRenderer } from '../../learning/blocks';
import { getBlockMeta } from '../../learning/blocks/registry';

export default function CoursePreviewModal({ course, lang = 'ht', onClose }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const [moduleIndex, setModuleIndex] = useState(0);
  const [previewBlockId, setPreviewBlockId] = useState(null);
  const [device, setDevice] = useState('desktop'); // desktop | tablet | mobile
  const [activeTab, setActiveTab] = useState('preview'); // preview | seo

  const module = modules.length > 0 ? modules[Math.min(moduleIndex, modules.length - 1)] : null;
  const blocks = (module && Array.isArray(module.blocks)) ? module.blocks : [];
  const previewBlock = previewBlockId != null
    ? blocks.find((b) => String(b.id) === String(previewBlockId)) || null
    : null;

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t('Close preview', 'Fèmen preview')}
      style={{
        border: 'none', background: 'transparent', color: 'var(--text-secondary)',
        fontSize: '1.1rem', cursor: 'pointer', padding: 6,
      }}
    >
      <i className="fas fa-times" aria-hidden="true" />
    </button>
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Preview as learner', 'Gade kòm elèv')}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg, #0f172a)', border: '1px solid var(--border-color, #1e293b)',
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      }}>
        {/* Header — learner chrome */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
          borderBottom: '1px solid var(--border-color, #1e293b)',
        }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-primary, #d81b60)', color: '#fff', fontSize: '0.9rem',
          }}>
            <i className="fas fa-graduation-cap" aria-hidden="true" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              {t('Preview as learner', 'Gade kòm elèv')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {course?.title || t('Untitled course', 'Kou san tit')}
            </div>
          </div>
          {/* Device switcher */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, rgba(148,163,184,0.08))', borderRadius: 6, padding: 2 }}>
            {[{ key: 'desktop', icon: 'fa-desktop', w: '100%' }, { key: 'tablet', icon: 'fa-tablet-screen-button', w: '768px' }, { key: 'mobile', icon: 'fa-mobile-screen-button', w: '375px' }].map((d) => (
              <button key={d.key} type="button" onClick={() => setDevice(d.key)} style={{
                padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                background: device === d.key ? 'var(--color-primary)' : 'transparent',
                color: device === d.key ? '#fff' : 'var(--text-secondary)',
              }} title={d.key}>
                <i className={`fas ${d.icon}`} />
              </button>
            ))}
          </div>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, rgba(148,163,184,0.08))', borderRadius: 6, padding: 2 }}>
            {[{ key: 'preview', label: 'Preview' }, { key: 'seo', label: 'SEO' }].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={{
                padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                background: activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
          {closeBtn}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '100%', maxWidth: '100%', transition: 'width 0.3s ease' }}>
          {modules.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '40px 0' }}>
              {t(
                'This course has no modules yet. Add modules and blocks in the editor to preview them.',
                'Kou sa a poko gen modil. Ajoute modil ak blòk nan editè a pou w ka wè yo an preview.',
              )}
            </p>
          ) : previewBlock ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewBlockId(null)}
                style={{
                  border: '1px solid var(--border-color, #1e293b)', background: 'transparent',
                  color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 12px',
                  fontSize: '0.8rem', cursor: 'pointer', marginBottom: 14,
                }}
              >
                <i className="fas fa-arrow-left" aria-hidden="true" /> {t('Back to module', 'Retounen nan modil')}
              </button>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {t('Lesson', 'Leson')} · {moduleIndex + 1} / {modules.length}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                  {previewBlock.title || getBlockMeta(previewBlock.type).label[lang] || t('Block', 'Blòk')}
                </h3>
              </div>
              <div style={{
                padding: 16, borderRadius: 12,
                background: 'var(--bg-elevated, #f8fafc)', color: 'var(--text, #0f172a)',
                border: '1px solid var(--border-color, #e5e7eb)',
              }}>
                <BlockRenderer block={previewBlock} lang={lang} courseId={null} moduleIndex={moduleIndex} />
              </div>
            </>
          ) : (
            <>
              {/* Module stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => { setModuleIndex((i) => Math.max(0, i - 1)); setPreviewBlockId(null); }}
                  disabled={moduleIndex === 0}
                  aria-label={t('Previous module', 'Modil anvan')}
                  style={{
                    border: '1px solid var(--border-color, #1e293b)', background: 'transparent',
                    color: 'var(--text-secondary)', borderRadius: 8, width: 34, height: 34,
                    cursor: moduleIndex === 0 ? 'default' : 'pointer', opacity: moduleIndex === 0 ? 0.4 : 1,
                  }}
                >
                  <i className="fas fa-chevron-left" aria-hidden="true" />
                </button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {t('Module', 'Modil')} {moduleIndex + 1} / {modules.length}
                </div>
                <button
                  type="button"
                  onClick={() => { setModuleIndex((i) => Math.min(modules.length - 1, i + 1)); setPreviewBlockId(null); }}
                  disabled={moduleIndex === modules.length - 1}
                  aria-label={t('Next module', 'Pwochen modil')}
                  style={{
                    border: '1px solid var(--border-color, #1e293b)', background: 'transparent',
                    color: 'var(--text-secondary)', borderRadius: 8, width: 34, height: 34,
                    cursor: moduleIndex === modules.length - 1 ? 'default' : 'pointer',
                    opacity: moduleIndex === modules.length - 1 ? 0.4 : 1,
                  }}
                >
                  <i className="fas fa-chevron-right" aria-hidden="true" />
                </button>
              </div>

              {/* Module header */}
              <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>
                {module.title.trim() || t(`Module ${moduleIndex + 1}`, `Modil ${moduleIndex + 1}`)}
              </h2>
              {module.description && (
                <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {module.description}
                </p>
              )}

              {/* Block list — click to preview each one */}
              {blocks.length === 0 ? (
                <p style={{
                  padding: '28px 16px', textAlign: 'center', borderRadius: 12,
                  border: '1px dashed var(--border-color, #1e293b)',
                  color: 'var(--text-secondary)', fontSize: '0.82rem',
                }}>
                  {t(
                    'This module has no content blocks yet.',
                    'Modil sa a poko gen blòk kontni.',
                  )}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blocks.map((b, bi) => {
                    const meta = getBlockMeta(b.type);
                    return (
                      <button
                        key={b.id || bi}
                        type="button"
                        onClick={() => setPreviewBlockId(b.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: 'var(--bg-elevated, #f8fafc)', color: 'inherit',
                          border: '1px solid var(--border-color, #1e293b)',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary, #d81b60)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #1e293b)'; }}
                      >
                        <span style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(216,27,96,0.12)', color: 'var(--color-primary, #d81b60)',
                        }}>
                          <i className={`fas ${meta.icon}`} aria-hidden="true" />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>
                            {b.title || meta.label[lang] || meta.label.en || b.type}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            {meta.label[lang] || meta.label.en || b.type}
                          </span>
                        </span>
                        <i className="fas fa-eye" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('SEO Preview', 'Aparans SEO')}</h3>
            {/* Google preview */}
            <div style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ color: '#1a0dab', fontSize: '1.1rem', fontWeight: 400, marginBottom: 2 }}>
                {course?.title || t('Course Title', 'Tit Kou')} — Atelnyo
              </div>
              <div style={{ color: '#006621', fontSize: '0.82rem', marginBottom: 2 }}>
                https://atelnyo.site/{course?.slug || 'c/...'}
              </div>
              <div style={{ color: '#545454', fontSize: '0.82rem', lineHeight: 1.4 }}>
                {(course?.description || '').slice(0, 160)}{(course?.description || '').length > 160 ? '...' : ''}
              </div>
            </div>
            {/* OG Preview */}
            <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>Open Graph / Facebook</h4>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12 }}>
              {course?.image_url && (
                <div style={{ width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: '#f0f0f0' }}>
                  <img src={course.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ fontSize: '0.82rem', color: '#1a0dab', fontWeight: 600 }}>{course?.title || t('Course Title', 'Tit Kou')}</div>
              <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 2 }}>{(course?.description || '').slice(0, 100)}...</div>
              <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 4, textTransform: 'uppercase' }}>atelnyo.site</div>
            </div>
            {/* SEO fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Title', value: course?.title, len: (course?.title || '').length, max: 60 },
                { label: 'Description', value: course?.description, len: (course?.description || '').length, max: 160 },
                { label: 'Image', value: course?.image_url ? '✅ Set' : '❌ Missing', warn: !course?.image_url },
                { label: 'Slug', value: course?.slug || 'Auto-generated' },
              ].map((f) => (
                <div key={f.label} style={{ padding: 8, borderRadius: 6, background: 'var(--surface-2, rgba(148,163,184,0.06))' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: '0.82rem', color: f.warn ? '#ef4444' : 'var(--text-primary)', fontWeight: 500 }}>
                    {f.value || '—'}
                    {f.len != null && f.max && <span style={{ fontSize: '0.68rem', color: f.len > f.max ? '#ef4444' : 'var(--text-secondary)', marginLeft: 4 }}>({f.len}/{f.max})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 18px', borderTop: '1px solid var(--border-color, #1e293b)',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--border-color, #1e293b)', background: 'transparent',
              color: 'var(--text-secondary)', borderRadius: 10, padding: '8px 18px',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('Back to editor', 'Retounen nan editè')}
          </button>
        </div>
      </div>
    </div>
  );
}
