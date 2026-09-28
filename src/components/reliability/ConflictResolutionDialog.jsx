/**
 * ConflictResolutionDialog — Phase 12 Reliability UX
 *
 * Shows when a sync conflict is detected.
 * Explains what happened and provides resolution options:
 * - Keep server version
 * - Keep local version
 * - Review differences
 *
 * Accessible: keyboard navigable, focus trap, screen reader support.
 */
import React, { useState, useEffect, useRef } from 'react';

const STYLES = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px',
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    maxWidth: '480px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    fontFamily: 'inherit',
  },
  header: {
    padding: '20px 24px 12px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: '#111827',
  },
  body: {
    padding: '16px 24px',
  },
  description: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  comparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
  },
  versionBox: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
  },
  versionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  footer: {
    padding: '12px 24px 20px',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  dangerBtn: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
};

const MESSAGES = {
  title: {
    en: 'Conflict Detected',
    ht: 'Konfli Detekte',
  },
  description: {
    en: 'This content was modified on another device or session. Your local changes are preserved and safe.',
    ht: 'Kontni sa a modifye sou yon lòt aparèy oswa sesyon. Chanjman lokal ou yo konsève ak an sekirite.',
  },
  localVersion: {
    en: 'Your changes',
    ht: 'Chanjman ou yo',
  },
  serverVersion: {
    en: 'Server version',
    ht: 'Vèsyon sèvè a',
  },
  keepLocal: {
    en: 'Keep my changes',
    ht: 'Kenbe chanjman mwen',
  },
  keepServer: {
    en: 'Use server version',
    ht: 'Itilize vèsyon sèvè a',
  },
  cancel: {
    en: 'Cancel',
    ht: 'Anile',
  },
};

/**
 * ConflictResolutionDialog
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {object} props.localData - Local version of the data
 * @param {object} props.serverData - Server version of the data
 * @param {string} [props.lang='en']
 * @param {Function} props.onResolve - (strategy: 'keep_local' | 'keep_server') => void
 * @param {Function} props.onCancel
 */
export default function ConflictResolutionDialog({
  open,
  localData,
  serverData,
  lang = 'en',
  onResolve,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  // Focus trap
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      // Focus the dialog
      setTimeout(() => {
        dialogRef.current?.focus();
      }, 100);
    } else if (previousFocus.current) {
      previousFocus.current.focus();
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  // Prevent background scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  const localPreview = localData ? (
    typeof localData === 'string' ? localData.slice(0, 200) : JSON.stringify(localData, null, 2).slice(0, 200)
  ) : '(none)';

  const serverPreview = serverData ? (
    typeof serverData === 'string' ? serverData.slice(0, 200) : JSON.stringify(serverData, null, 2).slice(0, 200)
  ) : '(none)';

  return (
    <div
      style={STYLES.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div
        ref={dialogRef}
        style={STYLES.dialog}
        tabIndex={-1}
      >
        <div style={STYLES.header}>
          <h2 id="conflict-dialog-title" style={STYLES.title}>
            {MESSAGES.title[lang] || MESSAGES.title.en}
          </h2>
        </div>

        <div style={STYLES.body}>
          <p style={STYLES.description}>
            {MESSAGES.description[lang] || MESSAGES.description.en}
          </p>

          <div style={STYLES.comparison}>
            <div style={STYLES.versionBox}>
              <div style={{ ...STYLES.versionLabel, color: '#3b82f6' }}>
                {MESSAGES.localVersion[lang] || MESSAGES.localVersion.en}
              </div>
              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {localPreview}
              </pre>
            </div>
            <div style={STYLES.versionBox}>
              <div style={{ ...STYLES.versionLabel, color: '#10b981' }}>
                {MESSAGES.serverVersion[lang] || MESSAGES.serverVersion.en}
              </div>
              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {serverPreview}
              </pre>
            </div>
          </div>
        </div>

        <div style={STYLES.footer}>
          <button
            style={{ ...STYLES.button, ...STYLES.secondaryBtn }}
            onClick={onCancel}
          >
            {MESSAGES.cancel[lang] || MESSAGES.cancel.en}
          </button>
          <button
            style={{ ...STYLES.button, ...STYLES.dangerBtn }}
            onClick={() => onResolve('keep_server')}
          >
            {MESSAGES.keepServer[lang] || MESSAGES.keepServer.en}
          </button>
          <button
            style={{ ...STYLES.button, ...STYLES.primaryBtn }}
            onClick={() => onResolve('keep_local')}
          >
            {MESSAGES.keepLocal[lang] || MESSAGES.keepLocal.en}
          </button>
        </div>
      </div>
    </div>
  );
}
