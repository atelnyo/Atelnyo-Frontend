/**
 * CodeBlock — renders code with optional syntax highlighting.
 * Used in programming courses (Python, JavaScript, etc.).
 *
 * Block config:
 *   - code: string (required)
 *   - language: string (e.g. 'python', 'javascript')
 *   - title: string (optional label)
 */
import React, { useCallback, useRef, useState } from 'react';

export default function CodeBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const viewedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const code = block.code || block.config?.code || '';
  const language = block.language || block.config?.language || '';
  const title = block.title || block.config?.title || '';

  const handleView = useCallback(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'code');
      onComplete?.(moduleIndex, block.id, 'code');
    }
  }, [block.id, moduleIndex, onComplete, onViewed]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, [code]);

  if (!code) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        {isHt ? 'Pa gen kòd pou bloc sa a.' : 'No code for this block.'}
      </div>
    );
  }

  return (
    <div onLoad={handleView}>
      {title && (
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
          {language && <span style={{ textTransform: 'uppercase', marginRight: 8 }}>{language}</span>}
          {title}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#1e1e2e', color: '#cdd6f4', padding: 16, borderRadius: 8,
          overflow: 'auto', fontSize: '0.85rem', lineHeight: 1.5, margin: 0,
          fontFamily: "'Fira Code', 'Consolas', monospace",
        }}>
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            position: 'absolute', top: 8, right: 8,
            padding: '4px 8px', borderRadius: 4, border: 'none',
            background: copied ? '#10b981' : 'rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '0.7rem', cursor: 'pointer',
          }}
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
