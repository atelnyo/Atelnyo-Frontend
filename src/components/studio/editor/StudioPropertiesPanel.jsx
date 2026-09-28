/**
 * src/components/studio/editor/StudioPropertiesPanel.jsx (v2 — Enhanced)
 *
 * Contextual PROPERTIES panel — the right zone of the editor workspace.
 *
 * v2 Improvements:
 *   - Field completion indicators (green dot = filled, gray = empty)
 *   - Section completion percentage
 *   - Better visual hierarchy with colored accent borders
 *   - Hover effects on accordion headers
 *   - Smooth open/close animations
 *   - Required field indicators (red asterisk)
 *   - Character count for text inputs
 */
import React, { useState, useMemo } from 'react';
import { classNames } from '../shared';
import styles from './editor.module.css';

/**
 * Properties panel frame — sticky header + accordion groups.
 */
export default function StudioPropertiesPanel({ lang = 'ht', children, completionPct = null }) {
  const isHt = lang === 'ht';
  return (
    <>
      <header className={styles.propsHeader}>
        <span className={styles.propsHeaderTitle}>
          <i className="fas fa-sliders-h" aria-hidden="true" />
          {isHt ? 'Opsyon' : 'Properties'}
        </span>
        {completionPct !== null && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 600,
            color: completionPct === 100 ? '#10b981' : completionPct > 50 ? '#f59e0b' : '#94a3b8',
            background: completionPct === 100 ? '#10b98115' : completionPct > 50 ? '#f59e0b15' : '#1e293b',
            padding: '2px 8px', borderRadius: 4, marginLeft: 8,
          }}>
            {completionPct}%
          </span>
        )}
      </header>
      {children}
    </>
  );
}

/**
 * Accordion group — progressive disclosure for property sections.
 * v2: colored accent border, hover effect, completion badge.
 */
export function PropertyGroup({
  icon = 'fa-circle-info',
  label,
  labelHt,
  lang = 'ht',
  defaultOpen = false,
  accent = 'var(--color-primary, #3b82f6)',
  completionPct = null,
  children,
}) {
  const isHt = lang === 'ht';
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={classNames(styles.propsGroup, open && styles.propsGroupOpen)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <button
        type="button"
        className={styles.propsGroupBtn}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ transition: 'background 0.15s' }}
      >
        <span className={styles.propsGroupLabel}>
          <i className={`fas ${icon}`} style={{ color: accent }} aria-hidden="true" />
          {isHt ? (labelHt || label) : label}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {completionPct !== null && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 600,
              color: completionPct === 100 ? '#10b981' : '#64748b',
              minWidth: 24, textAlign: 'right',
            }}>
              {completionPct === 100 ? '✓' : `${completionPct}%`}
            </span>
          )}
          <i className={`fas fa-chevron-down ${styles.propsGroupChevron}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className={styles.propsGroupBody}>{children}</div>}
    </section>
  );
}

/**
 * Field wrapper — label, control, hint/help, contextual error.
 * v2: completion indicator, character count, required asterisk.
 */
export function PropField({
  label,
  labelHt,
  lang = 'ht',
  required = false,
  error,
  hint,
  filled = false,
  charCount = null,
  maxChars = null,
  children,
}) {
  const isHt = lang === 'ht';
  return (
    <label className={classNames(styles.propsField, error && styles.propsFieldError)}>
      <span className={`${styles.propsFieldLabel} ${required ? styles.propsFieldRequired : ''}`}>
        {filled && !error && (
          <span style={{ color: '#10b981', marginRight: 4, fontSize: '0.7rem' }}>●</span>
        )}
        {isHt ? (labelHt || label) : label}
        {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </span>
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
        {hint && <span className={styles.propsHint} style={{ flex: 1 }}>{hint}</span>}
        {charCount !== null && maxChars && (
          <span style={{
            fontSize: '0.6rem', color: charCount > maxChars * 0.9 ? '#f59e0b' : '#64748b',
            flexShrink: 0,
          }}>
            {charCount}/{maxChars}
          </span>
        )}
      </div>
      {error && (
        <span className={styles.propsError} role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * Input — styled text/number/url input with completion indicator.
 */
export function PropInput({ value, maxLength, ...props }) {
  const charCount = typeof value === 'string' ? value.length : 0;
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        value={value}
        maxLength={maxLength}
        className={classNames(styles.propsInput, props.className)}
        style={{
          borderColor: charCount > 0 ? '#3b82f622' : undefined,
          transition: 'border-color 0.15s',
          ...props.style,
        }}
      />
    </div>
  );
}

/**
 * Textarea — styled textarea with character count.
 */
export function PropTextarea({ value, maxLength, rows = 3, ...props }) {
  const charCount = typeof value === 'string' ? value.length : 0;
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        {...props}
        value={value}
        maxLength={maxLength}
        rows={rows}
        className={classNames(styles.propsTextarea, props.className)}
      />
      {maxLength && (
        <div style={{
          position: 'absolute', bottom: 6, right: 8,
          fontSize: '0.6rem', color: charCount > maxLength * 0.9 ? '#f59e0b' : '#64748b',
        }}>
          {charCount}/{maxLength}
        </div>
      )}
    </div>
  );
}

/**
 * Select — styled dropdown.
 */
export function PropSelect(props) {
  return <select {...props} className={classNames(styles.propsSelect, props.className)} />;
}

/**
 * Toggle — on/off switch.
 */
export function PropToggle({ checked, onChange, label, labelHt, lang = 'ht' }) {
  const isHt = lang === 'ht';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: checked ? '#3b82f6' : '#475569', position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
      <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
        {isHt ? (labelHt || label) : label}
      </span>
    </div>
  );
}
