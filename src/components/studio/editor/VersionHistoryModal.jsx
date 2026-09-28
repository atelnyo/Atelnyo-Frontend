/**
 * src/components/studio/editor/VersionHistoryModal.jsx
 *
 * Creator-only course version history — shows the timeline of content
 * snapshots with field-level change summaries and rollback capability.
 *
 * Uses:
 *   GET  /api/courses/<id>/versions/     — version list with summaries
 *   POST /api/courses/<id>/rollback/     — restore a historical version
 *
 * All data from the real CourseVersion model rows.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { courseService } from '../../../services/api';
import styles from '../sections/sections.module.css';

// Map field names to human-readable labels
const FIELD_LABELS = {
  ht: {
    title: 'Tit', description: 'Deskripsyon', tags: 'Tags', price: 'Pri',
    category: 'Kategori', difficulty: 'Difilte', teaching_language: 'Lang kou',
    learner_language: 'Lang elèv', learning_objective: 'Objektif aprantisaj',
    image_url: 'Imaj', video_url: 'Videyo', syllabus: 'Sikilom',
    delivery_type: 'Kalite livrezon', external_url: 'Lyen ekstèn',
    external_format: 'Fòma ekstèn', content: 'Kontni',
  },
  en: {
    title: 'Title', description: 'Description', tags: 'Tags', price: 'Price',
    category: 'Category', difficulty: 'Difficulty', teaching_language: 'Teaching language',
    learner_language: 'Learner language', learning_objective: 'Learning objective',
    image_url: 'Image', video_url: 'Video', syllabus: 'Syllabus',
    delivery_type: 'Delivery type', external_url: 'External URL',
    external_format: 'External format', content: 'Content',
  },
};

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

export default function VersionHistoryModal({ courseId, lang = 'ht', onClose, onRestored }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const labels = FIELD_LABELS[lang] || FIELD_LABELS.en;

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await courseService.getVersions(courseId);
      setVersions(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not load version history.', 'Pa t kapab chaje istwa vèsyon yo.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, lang]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = useCallback(async (version) => {
    setRestoring(true);
    setError('');
    try {
      await courseService.rollback(courseId, version);
      setConfirmRestore(null);
      onRestored?.();
      load(); // refresh list
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not restore this version.', 'Pa t kapab retounen vèsyon sa a.'));
    } finally {
      setRestoring(false);
    }
  }, [courseId, load, onRestored, t, isHt]);

  return (
    <div
      className={styles.analyticsBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Version History', 'Istwa Vèsyon')}
    >
      <div className={styles.analyticsModal} style={{ maxWidth: 560 }}>
        <header className={styles.analyticsHeader}>
          <span className={styles.analyticsIcon}><i className="fas fa-clock-rotate-left" /></span>
          <div>
            <h2>{t('Version History', 'Istwa Vèsyon')}</h2>
            <p className={styles.analyticsCourse}>
              {t('Last 50 versions', 'Dènye 50 vèsyon yo')} · {versions.length} {t('total', 'total')}
            </p>
          </div>
          <button type="button" className={styles.analyticsClose} onClick={onClose} aria-label={t('Close', 'Fèmen')}>
            <i className="fas fa-times" />
          </button>
        </header>

        {error && (
          <p className={styles.analyticsError} role="alert" style={{ margin: '12px 20px 0' }}>
            <i className="fas fa-circle-exclamation" /> {error}
          </p>
        )}

        {loading ? (
          <p className={styles.analyticsLoading} style={{ padding: '32px 20px' }}>
            <i className="fas fa-spinner fa-spin" /> {t('Loading…', 'Ap chaje…')}
          </p>
        ) : versions.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <i className="fas fa-clock" style={{ fontSize: '2rem', opacity: 0.3, marginBottom: 8, display: 'block' }} />
            <p>{t('No version history yet. Versions are created when you save or publish.', 'Pa gen istwa vèsyon ankò. Vèsyon yo kreye lè ou sove oswa pibliye.')}</p>
          </div>
        ) : (
          <div style={{ padding: '12px 20px', maxHeight: '50vh', overflowY: 'auto' }}>
            {/* Confirm restore dialog */}
            {confirmRestore && (
              <div style={{
                padding: 16, borderRadius: 8, marginBottom: 16,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>
                  <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b' }} />{' '}
                  {t('Restore version', 'Retounen vèsyon')} {confirmRestore.version}?
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {t(
                    'This will replace current content with the snapshot from this version. A new version will be created recording this restore. Status and ownership are NOT changed.',
                    'Sa ap ranplase kontni aktyèl la ak vèsyon ki soti nan sa a. Yon nouvo vèsyon ap kreye ki anrejistre retoun sa a. Stati ak pwopriyete pa chanje.'
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleRestore(confirmRestore.version)}
                    disabled={restoring}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: 'none',
                      background: '#f59e0b', color: '#000', fontWeight: 600,
                      cursor: restoring ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontFamily: 'inherit',
                    }}
                  >
                    {restoring ? t('Restoring…', 'Ap retounen…') : t('Yes, restore', 'Wi, retounen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(null)}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-color)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit',
                    }}
                  >
                    {t('Cancel', 'Anile')}
                  </button>
                </div>
              </div>
            )}

            {/* Version list */}
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute', left: 6, top: 0, bottom: 0, width: 2,
                background: 'var(--border-color, #334155)', borderRadius: 1,
              }} />

              {versions.map((v, i) => {
                const isFirst = i === 0;
                const changeFields = v.summary || [];
                return (
                  <div key={v.id} style={{ position: 'relative', marginBottom: 20 }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: -20, top: 4, width: 14, height: 14,
                      borderRadius: '50%', border: '2px solid var(--border-color, #334155)',
                      background: isFirst ? 'var(--color-primary, #3b82f6)' : 'var(--bg, #0f172a)',
                      zIndex: 1,
                    }} />

                    {/* Version card */}
                    <div style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: isFirst ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated, #1e293b)',
                      border: `1px solid ${isFirst ? 'rgba(59,130,246,0.2)' : 'var(--border-color, #334155)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                          {t('Version', 'Vèsyon')} {v.version}
                        </span>
                        {isFirst && (
                          <span style={{
                            fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 600,
                          }}>
                            {t('CURRENT', 'AKTYÈL')}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                          {formatTimestamp(v.created_at)}
                        </span>
                      </div>

                      {v.change_note && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
                          {v.change_note}
                        </p>
                      )}

                      {changeFields.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {changeFields.map((f) => (
                            <span key={f} style={{
                              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                              background: 'var(--bg-hover, #334155)', color: 'var(--text-secondary)',
                            }}>
                              {labels[f] || f}
                            </span>
                          ))}
                        </div>
                      )}

                      {v.created_by_username && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {v.created_by_username}
                        </div>
                      )}

                      {/* Restore button — not for the current version */}
                      {!isFirst && (
                        <button
                          type="button"
                          onClick={() => setConfirmRestore(v)}
                          style={{
                            marginTop: 6, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid var(--border-color, #334155)',
                            background: 'transparent', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <i className="fas fa-rotate-left" /> {t('Restore', 'Retounen')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <footer className={styles.analyticsFooter}>
          <button type="button" className={styles.analyticsDone} onClick={onClose}>
            {t('Done', 'Fini')}
          </button>
        </footer>
      </div>
    </div>
  );
}
