/**
 * src/components/studio/sections/CourseExportImportModal.jsx
 *
 * Creator Studio modal for exporting and importing courses as portable
 * JSON packages. Uses the backend export_course / import_course endpoints.
 *
 * Export: downloads a JSON file with chapters, lessons, blocks, quizzes, FAQs
 * Import: upload a JSON file and creates a new draft course
 */
import React, { useState, useCallback, useRef } from 'react';
import { courseService } from '../../../services/api';
import styles from './sections.module.css';

export default function CourseExportImportModal({ course, lang = 'ht', onClose, onImportSuccess }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [mode, setMode] = useState(course ? 'export' : 'import'); // 'export' | 'import'
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ─── Export ──────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!course) return;
    setExporting(true);
    setError('');
    try {
      const res = await courseService.exportCourse(course.id);
      const data = res?.data;
      if (!data) throw new Error('No data returned');

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.slug || course.title || 'course'}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || t('Export failed.', 'Ekspòt echwe.'));
    } finally {
      setExporting(false);
    }
  }, [course, t, isHt]);

  // ─── Import ──────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.format || data.format !== 'atelnyo-course-v1') {
        throw new Error(t('Invalid format. Expected atelnyo-course-v1.', 'Fòma envalid. Ekspèkte atelnyo-course-v1.'));
      }

      const res = await courseService.importCourse(data);
      setImportResult(res?.data);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError(t('Invalid JSON file.', 'Fichye JSON envalid.'));
      } else {
        setError(e?.response?.data?.detail || e.message || t('Import failed.', 'Enpòt echwe.'));
      }
    } finally {
      setImporting(false);
    }
  }, [t, isHt]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div
      className={styles.analyticsBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Export / Import Course', 'Ekspòt / Enpòt Kou')}
    >
      <div className={styles.analyticsModal} style={{ maxWidth: 520 }}>
        <header className={styles.analyticsHeader}>
          <span className={styles.analyticsIcon}><i className="fas fa-exchange-alt" /></span>
          <div>
            <h2>{t('Export / Import', 'Ekspòt / Enpòt')}</h2>
            <p className={styles.analyticsCourse}>{course?.title || t('Import a course', 'Enpòte yon kou')}</p>
          </div>
          <button type="button" className={styles.analyticsClose} onClick={onClose} aria-label={t('Close', 'Fèmen')}>
            <i className="fas fa-times" />
          </button>
        </header>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0' }}>
          <button
            type="button"
            onClick={() => setMode('export')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: mode === 'export' ? 'var(--color-primary, #3b82f6)' : 'transparent',
              color: mode === 'export' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
            }}
          >
            <i className="fas fa-download" style={{ marginRight: 6 }} />
            {t('Export', 'Ekspòt')}
          </button>
          <button
            type="button"
            onClick={() => setMode('import')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: mode === 'import' ? 'var(--color-primary, #3b82f6)' : 'transparent',
              color: mode === 'import' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
            }}
          >
            <i className="fas fa-upload" style={{ marginRight: 6 }} />
            {t('Import', 'Enpòt')}
          </button>
        </div>

        {error && (
          <p className={styles.analyticsError} role="alert" style={{ margin: '12px 20px 0' }}>
            <i className="fas fa-circle-exclamation" /> {error}
          </p>
        )}

        <div style={{ padding: '16px 20px' }}>
          {mode === 'export' ? (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                {t(
                  'Download your course as a portable JSON file. This includes chapters, lessons, content blocks, quizzes, and FAQs — but no user data (enrollments, progress).',
                  'Telechaje kou ou kòm yon fichye JSON pòtab. Sa gen ladan chapit, leson, blòk kontni, kiz, ak FAQ — men pa gen done itilizatè (enskripsyon, pwogrè).'
                )}
              </p>

              {/* Course summary */}
              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: 'var(--bg-elevated, #1e293b)', border: '1px solid var(--border-color, #334155)',
                marginBottom: 16, fontSize: '0.78rem',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{course?.title}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {course?.slug && <>slug: {course.slug} · </>}
                  {course?.status || 'draft'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !course}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: exporting ? '#666' : 'var(--color-primary, #3b82f6)',
                  color: '#fff', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-download'}`} />
                {exporting ? t('Exporting…', 'Ap ekspòte…') : t('Download JSON', 'Telechaje JSON')}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                {t(
                  'Upload a previously exported Atelyona course JSON file. It will be imported as a new draft course.',
                  'Telechaje yon fichye JSON kou Atelyonyo ki te ekspòte anvan. Li ap vin yon nouvo kou boradwa.'
                )}
              </p>

              {importResult ? (
                <div style={{
                  padding: '16px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#10b981', fontWeight: 600 }}>
                    <i className="fas fa-check-circle" /> {t('Import successful!', 'Enpòt reyisi!')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div>{t('Title:', 'Tit:')} {importResult.title}</div>
                    <div>{t('Chapters:', 'Chapit:')} {importResult.chapters}</div>
                    <div>{t('Status:', 'Stati:')} {t('Draft', 'Boradwa')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImportSuccess?.(importResult)}
                    style={{
                      marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer',
                      fontSize: '0.82rem', fontFamily: 'inherit',
                    }}
                  >
                    {t('Open in Editor', 'Ouvri nan Editè')}
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '32px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px dashed ${dragOver ? 'var(--color-primary, #3b82f6)' : 'var(--border-color, #334155)'}`,
                    background: dragOver ? 'rgba(59,130,246,0.05)' : 'transparent',
                    textAlign: 'center', transition: 'all 0.2s',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <i className="fas fa-cloud-arrow-up" style={{ fontSize: '2rem', color: 'var(--text-secondary)', opacity: 0.5, marginBottom: 8, display: 'block' }} />
                  {importing ? (
                    <p style={{ color: 'var(--text-secondary)' }}><i className="fas fa-spinner fa-spin" /> {t('Importing…', 'Ap enpòte…')}</p>
                  ) : (
                    <>
                      <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>
                        {t('Drop JSON file here', 'Met fichye JSON isit la')}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('or click to browse', 'oswa klike pou chwazi')}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className={styles.analyticsFooter}>
          <button type="button" className={styles.analyticsDone} onClick={onClose}>
            {t('Done', 'Fini')}
          </button>
        </footer>
      </div>
    </div>
  );
}
