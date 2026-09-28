/**
 * CalloutBlock — §29 Semantic callout system
 *
 * Uses the consistent CSS classes from LearningShell.css:
 *   .ls-callout .ls-callout--important
 *   .ls-callout--tip .ls-callout--warning .ls-callout--example .ls-callout--remember
 *
 * Not relying only on color — uses icon, label, structure.
 * Accessible semantic meaning via aria-label.
 *
 * Block config:
 *   - content: string (the note text)
 *   - variant: 'important' | 'tip' | 'warning' | 'example' | 'remember' | 'note'
 */
import React, { useCallback, useRef } from 'react';

const VARIANT_CONFIG = {
  important: { icon: 'fa-circle-info', label: { en: 'Important', ht: 'Enpòtan' } },
  tip:       { icon: 'fa-lightbulb', label: { en: 'Tip', ht: 'Konsèy' } },
  warning:   { icon: 'fa-triangle-exclamation', label: { en: 'Warning', ht: 'Atansyon' } },
  example:   { icon: 'fa-flask', label: { en: 'Example', ht: 'Egzanp' } },
  remember:  { icon: 'fa-bookmark', label: { en: 'Remember', ht: 'Sonje' } },
  note:      { icon: 'fa-circle-info', label: { en: 'Note', ht: 'Nòt' } },
  // Legacy aliases
  info:      { icon: 'fa-circle-info', label: { en: 'Info', ht: 'Enfòmasyon' } },
};

export default function CalloutBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const viewedRef = useRef(false);

  const content = block.content || block.config?.content || block.text || '';
  const rawVariant = block.variant || block.config?.variant || 'note';
  const variant = VARIANT_CONFIG[rawVariant] ? rawVariant : 'note';
  const config = VARIANT_CONFIG[variant];

  const handleView = useCallback(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'callout');
      // Callouts auto-complete on view
      onComplete?.(moduleIndex, block.id, 'callout');
    }
  }, [block.id, moduleIndex, onComplete, onViewed]);

  if (!content) return null;

  const label = config.label[lang] || config.label.en;

  return (
    <div
      className={`ls-callout ls-callout--${variant}`}
      role="note"
      aria-label={label}
      onLoad={handleView}
    >
      <div className="ls-callout-header">
        <i className={`fas ${config.icon} ls-callout-icon`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="ls-callout-body">
        {content}
      </div>
    </div>
  );
}
