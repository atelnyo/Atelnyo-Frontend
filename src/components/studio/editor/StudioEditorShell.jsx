/**
 * src/components/studio/editor/StudioEditorShell.jsx
 *
 * Editor-first workspace shell — the shared "room" every content editor
 * (course, music, product, …) mounts inside. Replaces the modal-card
 * creation form with a full-viewport creator workspace:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ← Back   COURSE EDITOR  "Title"  ● Saved   [Preview][Save][Publish] │
 *   ├───────────┬──────────────────────────────┬───────────────┤
 *   │ STRUCTURE │          EDITOR              │  PROPERTIES   │
 *   │ (tree)    │      (the canvas)            │  (accordions) │
 *   └───────────┴──────────────────────────────┴───────────────┘
 *   │   mobile only: [Content] [Properties]  [Save] [Publish]  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Responsibilities:
 *   • Header: back (with unsaved-changes guard), editor label + live
 *     document title, save-state pill, preview/save/publish actions.
 *   • Responsive zones: desktop 3-panel, tablet structure-drawer,
 *     mobile bottom-tabs + fixed action bar that never covers content
 *     (the main zone reserves its height) and respects PWA safe areas.
 *   • Save-state machine display: idle/dirty/saving/saved/error.
 *   • Contextual validation summary bar (list of missing items, each
 *     clickable to jump to the offending zone).
 *
 * The shell owns LAYOUT + SAVE-STATE UX only. Each editor owns its own
 * form state, API calls, and validation — the shell never touches the
 * data model or backend.
 */
import React, { Component, useEffect, useRef, useState } from 'react';
import { classNames } from '../shared';
import styles from './editor.module.css';

// Error boundary — catches render errors so the editor shell never
// shows a blank/black screen. Displays a clear recovery UI instead.
class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[EditorErrorBoundary]', error?.message, info?.componentStack?.slice(0, 500));
  }
  render() {
    if (this.state.hasError) {
      const isHt = this.props.lang === 'ht';
      return (
        <div className={styles.shell} role="dialog" aria-modal="true">
          <header className={styles.header}>
            <button type="button" className={styles.backBtn} onClick={this.props.onBack}>
              <i className="fas fa-arrow-left" />
              <span>{isHt ? 'Retounen' : 'Back'}</span>
            </button>
            <div className={styles.headerInfo}>
              <span className={styles.headerLabel}><i className="fas fa-pen" /> {this.props.title || 'Editor'}</span>
            </div>
          </header>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:32 }}>
            <div style={{ textAlign:'center', maxWidth:420 }}>
              <i className="fas fa-triangle-exclamation" style={{ fontSize:'2.5rem', color:'var(--color-error,#ef4444)', marginBottom:16 }} />
              <h2 style={{ fontSize:'1.1rem', color:'var(--text-primary,#e2e8f0)', marginBottom:8 }}>
                {isHt ? 'Gen yon erè nan editè a' : 'Editor error'}
              </h2>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary,#94a3b8)', marginBottom:20, lineHeight:1.5 }}>
                {isHt
                  ? 'Yon bagay pa mal pandan w ap modifye. Eseye reouvri editè a. Chanjman ki pa sove yo pèdi.'
                  : 'Something went wrong while editing. Try reopening the editor. Unsaved changes are lost.'}
              </p>
              <button type="button" onClick={this.props.onBack} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'var(--color-primary,#3b82f6)', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:'0.85rem' }}>
                <i className="fas fa-arrow-left" style={{ marginRight:6 }} />{isHt ? 'Retounen' : 'Go back'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SAVE_LABELS = {
  idle:   { en: 'Ready',        ht: 'Pare' },
  dirty:  { en: 'Unsaved changes', ht: 'Chanjman pa sove' },
  saving: { en: 'Saving…',      ht: 'Ap sove…' },
  saved:  { en: 'Saved just now', ht: 'Sove fèk kounye a' },
  error:  { en: 'Failed to save', ht: 'Echèk sove' },
};

export default function StudioEditorShell({
  title = 'Editor',
  icon = 'fa-pen',
  lang = 'ht',
  docTitle = '',
  isNew = false,
  dirty = false,
  saveState = 'idle',
  onBack,
  onPreview,
  onVersionHistory,
  onSave,
  onPublish,
  saveLabel,
  publishLabel,
  canSave = true,
  validation = [],
  onFixValidation,
  badge = null,
  structure = null,
  editor,
  properties,
  saveError = '',
}) {
  const isHt = lang === 'ht';
  // Mobile zone switching: 'editor' | 'structure' | 'props'
  const [zone, setZone] = useState('editor');
  // Tablet structure drawer
  const [structureOpen, setStructureOpen] = useState(false);
  // Unsaved-changes guard
  const [confirming, setConfirming] = useState(false);
  const pendingBack = useRef(false);

  const t = SAVE_LABELS[saveState] || SAVE_LABELS.idle;
  const statusText = isHt ? t.ht : t.en;

  const handleBack = () => {
    if (dirty && saveState !== 'saving') {
      pendingBack.current = true;
      setConfirming(true);
      return;
    }
    onBack?.();
  };

  const handleConfirmLeave = () => {
    setConfirming(false);
    pendingBack.current = false;
    onBack?.();
  };

  // Escape = back (with the same unsaved guard)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !confirming) handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onSaveClick = () => {
    if (saveState === 'saving' || !canSave) return;
    onSave?.();
  };

  const onPublishClick = () => {
    if (saveState === 'saving') return;
    onPublish?.();
  };

  // ─── Header actions (hidden on mobile — duplicated in bottom bar) ───
  const headerActions = (
    <>
      {onPreview && (
        <button type="button" className={styles.previewBtn} onClick={onPreview}>
          <i className="fas fa-eye" aria-hidden="true" />
          {isHt ? 'Preview' : 'Preview'}
        </button>
      )}
      {onVersionHistory && (
        <button type="button" className={styles.previewBtn} onClick={onVersionHistory}>
          <i className="fas fa-clock-rotate-left" aria-hidden="true" />
          {isHt ? 'Vèsyon' : 'Versions'}
        </button>
      )}
      {onSave && (
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSaveClick}
          disabled={saveState === 'saving' || !canSave}
        >
          {saveState === 'saving' ? (
            <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap sove…' : 'Saving…'}</>
          ) : (
            <><i className="fas fa-save" aria-hidden="true" /> {saveLabel || (isHt ? 'Sove' : 'Save')}</>
          )}
        </button>
      )}
      {onPublish && (
        <button
          type="button"
          className={styles.publishBtn}
          onClick={onPublishClick}
          disabled={saveState === 'saving'}
        >
          <i className="fas fa-rocket" aria-hidden="true" />
          {publishLabel || (isHt ? 'Pibliye' : 'Publish')}
        </button>
      )}
    </>
  );

  // ─── Mobile bottom bar (only the zone-relevant bits) ───────────────
  const bottomBar = (
    <nav className={styles.bottomBar} aria-label={isHt ? 'Kontwòl editè' : 'Editor controls'}>
      <div className={styles.bottomTabs} role="tablist" aria-label={isHt ? 'Zòn editè' : 'Editor zones'}>
        {structure && (
          <button
            type="button"
            role="tab"
            aria-selected={zone === 'structure'}
            className={`${styles.bottomTab} ${zone === 'structure' ? styles.bottomTabActive : ''}`}
            onClick={() => setZone('structure')}
          >
            <i className="fas fa-list-ul" aria-hidden="true" />
            {isHt ? 'Estrikti' : 'Content'}
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={zone === 'editor'}
          className={`${styles.bottomTab} ${zone === 'editor' ? styles.bottomTabActive : ''}`}
          onClick={() => setZone('editor')}
        >
          <i className="fas fa-pen-nib" aria-hidden="true" />
          {isHt ? 'Editè' : 'Editor'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={zone === 'props'}
          className={`${styles.bottomTab} ${zone === 'props' ? styles.bottomTabActive : ''}`}
          onClick={() => setZone('props')}
        >
          <i className="fas fa-sliders-h" aria-hidden="true" />
          {isHt ? 'Opsyon' : 'Properties'}
        </button>
      </div>
      <div className={styles.bottomActions}>
        {onPreview && (
          <button type="button" className={styles.previewBtn} onClick={onPreview} aria-label={isHt ? 'Preview' : 'Preview'}>
            <i className="fas fa-eye" aria-hidden="true" />
          </button>
        )}
        {onVersionHistory && (
          <button type="button" className={styles.previewBtn} onClick={onVersionHistory} aria-label={isHt ? 'Vèsyon' : 'Versions'}>
            <i className="fas fa-clock-rotate-left" aria-hidden="true" />
          </button>
        )}
        {onSave && (
          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSaveClick}
            disabled={saveState === 'saving' || !canSave}
          >
            {saveState === 'saving' ? (
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fas fa-save" aria-hidden="true" />
            )}
            {saveLabel || (isHt ? 'Sove' : 'Save')}
          </button>
        )}
        {onPublish && (
          <button
            type="button"
            className={styles.publishBtn}
            onClick={onPublishClick}
            disabled={saveState === 'saving'}
          >
            <i className="fas fa-rocket" aria-hidden="true" />
            {publishLabel || (isHt ? 'Pibliye' : 'Publish')}
          </button>
        )}
      </div>
      <div className={styles.bottomSaveState}>
        <i
          className={`fas ${saveState === 'saving' ? 'fa-spinner fa-spin' : saveState === 'saved' ? 'fa-circle-check' : saveState === 'error' ? 'fa-circle-exclamation' : 'fa-circle'}`}
          aria-hidden="true"
        />
        {statusText}
      </div>
    </nav>
  );

  // ─── Validation bar ────────────────────────────────────────────────
  const validationBar = validation.length > 0 && (
    <div className={styles.validationBar} role="status">
      <i className="fas fa-triangle-exclamation" aria-hidden="true" />
      <span>{isHt ? 'Anvan w pibliye:' : 'Before publishing:'}</span>
      <ul>
        {validation.map((v, i) => (
          <li key={i}>
            {onFixValidation ? (
              <button
                type="button"
                onClick={() => {
                  // On mobile (zones are tabs) jump to the panel the item
                  // lives in, so the checklist is genuinely actionable.
                  // On desktop the zones are always visible side by side,
                  // so leave the layout untouched.
                  const isMobile = window.matchMedia('(max-width: 768px)').matches;
                  if (isMobile) {
                    if (v.target === 'props') setZone('props');
                    if (v.target === 'structure') setZone('structure');
                    if (v.target === 'editor') setZone('editor');
                  }
                  onFixValidation(v);
                }}
              >
                {v.message}
              </button>
            ) : (
              v.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <EditorErrorBoundary lang={lang} onBack={handleBack} title={title}>
    <div className={styles.shell} role="dialog" aria-modal="true" aria-label={title} data-studio-editor>
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={handleBack} aria-label={isHt ? 'Retounen' : 'Back'}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
          <span>{isHt ? 'Retounen' : 'Back'}</span>
        </button>
        {structure && (
          <button
            type="button"
            className={styles.structureToggle}
            onClick={() => setStructureOpen((o) => !o)}
            aria-label={isHt ? 'Louvri estrikti kontni' : 'Open content structure'}
            title={isHt ? 'Estrikti' : 'Structure'}
          >
            <i className="fas fa-list-ul" aria-hidden="true" />
          </button>
        )}
        <div className={styles.headerInfo}>
          <span className={styles.headerLabel}>
            <i className={`fas ${icon}`} aria-hidden="true" />
            {title}
            {badge}
          </span>
          <span className={styles.headerDocTitle} title={docTitle}>
            {docTitle || (isNew ? (isHt ? 'Nouvo kontni' : 'New content') : '')}
          </span>
        </div>
        <span
          className={classNames(styles.saveState, saveState !== 'idle' && styles[`saveState${saveState[0].toUpperCase()}${saveState.slice(1)}`])}
          role="status"
          aria-live="polite"
        >
          <i
            className={`fas ${saveState === 'saving' ? 'fa-spinner fa-spin' : saveState === 'saved' ? 'fa-circle-check' : saveState === 'error' ? 'fa-circle-exclamation' : 'fa-circle'}`}
            aria-hidden="true"
          />
          {statusText}
        </span>
        <div className={styles.headerActions}>{headerActions}</div>
      </header>

      {/* ─── Validation bar ─────────────────────────────────── */}
      {validationBar}

      {/* ─── Save/publish error — the real reason a publish was
           rejected (server-side gate: missing title / short
           description / no cover / bad external URL). Without this
           the editor showed only "Failed to save" with no detail. */}
      {saveError && (
        <div className={styles.saveErrorBar} role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ─── Body ───────────────────────────────────────────── */}
      <div
        className={classNames(
          styles.body,
          !structure && styles.bodyTwoZone,
        )}
      >
        {/* Structure — hidden on mobile, drawer on tablet */}
        {structure && (
          <>
            <div
              className={`${styles.structureOverlay} ${structureOpen ? styles.structureOverlayVisible : ''}`}
              onClick={() => setStructureOpen(false)}
              aria-hidden="true"
            />
            <div className={`${styles.structure} ${structureOpen ? styles.structureOpen : ''}`}>
              {structure}
            </div>
          </>
        )}

        {/* Main zone: editor (desktop/tablet + mobile 'editor' tab) */}
        <main className={styles.main} aria-label={isHt ? 'Editè prensipal' : 'Main editor'}>
          {zone === 'props' ? (
            <div className={styles.mobileZone}>{properties}</div>
          ) : zone === 'structure' && structure ? (
            <div className={styles.mobileZone}>{structure}</div>
          ) : (
            editor
          )}
        </main>

        {/* Properties — hidden on mobile, shown in 'props' tab */}
        {zone !== 'props' && <div className={styles.props}>{properties}</div>}
      </div>

      {/* ─── Mobile bottom bar ──────────────────────────────── */}
      {bottomBar}

      {/* ─── Unsaved-changes confirm ────────────────────────── */}
      {confirming && (
        <div className={styles.confirmWrap} role="alertdialog" aria-modal="true" aria-labelledby="editor-confirm-title">
          <div className={styles.confirmCard}>
            <h3 id="editor-confirm-title">{isHt ? 'Gen chanjman ki pa sove' : 'Unsaved changes'}</h3>
            <p>
              {isHt
                ? 'Gen chanjman ou fè ki poko sove. Si w kite editè a, yo p ap sove. W ap vle kite menm jan an?'
                : 'You have unsaved changes. Leaving the editor will discard them. Leave anyway?'}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmBtn} onClick={() => setConfirming(false)}>
                {isHt ? 'Retounen nan editè' : 'Keep editing'}
              </button>
              <button type="button" className={`${styles.confirmBtn} ${styles.confirmBtnPrimary}`} onClick={handleConfirmLeave}>
                {isHt ? 'Kite san sove' : 'Discard & leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </EditorErrorBoundary>
  );
}
