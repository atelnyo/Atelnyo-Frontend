/**
 * RecoveryBanner — §25, §30, §32 Recovery UI
 *
 * §25 — "The student should not need to understand technical networking
 *         details."
 * §30 — "If synchronization repeatedly fails: Preserve the local draft
 *         where safely possible. Inform the student appropriately."
 * §32 — "Recovery should not feel technical."
 *        "Welcome back. Your previous work was restored."
 *        "You have unsynchronized work from a previous session."
 *
 * A calm, dismissible banner shown when the student returns after
 * an interruption or when there's pending sync work.
 */
import React, { useState } from 'react';

/**
 * RecoveryBanner
 *
 * @param {Object} props
 * @param {'restored' | 'sync_pending' | 'sync_failed' | 'offline'} props.type
 * @param {string} [props.lang='ht']
 * @param {Function} [props.onDismiss]
 * @param {Function} [props.onRetry] — for sync_failed
 */
export default function RecoveryBanner({ type, lang = 'ht', onDismiss, onRetry }) {
  const [visible, setVisible] = useState(true);

  if (!visible || !type) return null;

  const messages = {
    restored: {
      icon: 'fa-check-circle',
      color: 'var(--pr-color-green-500, #22c55e)',
      bg: 'var(--pr-color-green-500-bg, rgba(34,197,94,0.08))',
      text: lang === 'ht'
        ? 'Byenveni! Travay ou anvan an te restore.'
        : 'Welcome back! Your previous work was restored.',
    },
    sync_pending: {
      icon: 'fa-clock',
      color: 'var(--pr-color-amber-500, #f59e0b)',
      bg: 'var(--pr-color-amber-500-bg, rgba(245,158,11,0.08))',
      text: lang === 'ht'
        ? 'Gen travay ki pa encore senkronize. Li pral sove otomatikman.'
        : 'You have unsynchronized work. It will sync automatically.',
    },
    sync_failed: {
      icon: 'fa-exclamation-triangle',
      color: 'var(--pr-color-red-500, #ef4444)',
      bg: 'var(--pr-color-red-500-bg, rgba(239,68,68,0.08))',
      text: lang === 'ht'
        ? 'Senkronizasyon an echwe. Travay ou a sove sou aparèy sa a.'
        : 'Sync failed. Your work is saved on this device.',
    },
    offline: {
      icon: 'fa-wifi',
      color: 'var(--pr-color-blue-500, #3b82f6)',
      bg: 'var(--pr-color-blue-500-bg, rgba(59,130,246,0.08))',
      text: lang === 'ht'
        ? 'Ou pa konekte. Travay ou a pral sove sou aparèy sa a.'
        : 'You\'re offline. Supported work will be saved on this device.',
    },
    storage_full: {
      icon: 'fa-hdd',
      color: 'var(--pr-color-red-500, #ef4444)',
      bg: 'var(--pr-color-red-500-bg, rgba(239,68,68,0.08))',
      text: lang === 'ht'
        ? 'Espas depo a plen. Eseye efase dosye oswa aplikasyon pou fè plas.'
        : 'Storage is full. Try removing files or apps to free space.',
    },
  };

  const m = messages[type];
  if (!m) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className="ls-recovery-banner"
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 8,
        background: m.bg,
        border: `1px solid ${m.color}20`,
        fontSize: '0.85rem',
        color: m.color,
        marginBottom: 12,
        animation: 'ls-recovery-fadein 0.3s ease',
      }}
    >
      <i className={`fas ${m.icon}`} aria-hidden="true" />
      <span style={{ flex: 1 }}>{m.text}</span>
      {type === 'sync_failed' && onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none',
            border: `1px solid ${m.color}`,
            color: m.color,
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          {lang === 'ht' ? 'Eseye ankò' : 'Retry'}
        </button>
      )}
      <button
        onClick={handleDismiss}
        aria-label={lang === 'ht' ? 'Fèmen' : 'Dismiss'}
        style={{
          background: 'none',
          border: 'none',
          color: m.color,
          cursor: 'pointer',
          padding: 4,
          fontSize: '0.8rem',
          opacity: 0.7,
        }}
      >
        <i className="fas fa-times" aria-hidden="true" />
      </button>
    </div>
  );
}
