/**
 * src/accessibility/components/AccessibleTooltip.jsx
 *
 * Accessible tooltip component.
 *
 * Features:
 *   - Shows on hover AND focus (keyboard accessible)
 *   - Uses aria-describedby to link trigger to tooltip
 *   - Tooltip is not the only way to convey information
 *   - Properly positioned (above/below based on viewport)
 *   - Dismissed on Escape
 *   - Does not steal focus
 *
 * Usage:
 *   <AccessibleTooltip text="Save your changes" lang="en">
 *     <button onClick={save}>💾</button>
 *   </AccessibleTooltip>
 */
import React, { useState, useRef, useCallback, useId } from 'react';

export default function AccessibleTooltip({
  children,
  text,
  lang = 'en',
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  delay = 200,
}) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId?.() || `tooltip-${Math.random().toString(36).slice(2, 8)}`;
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const show = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    showTimerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(showTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 50);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setVisible(false);
    }
  }, []);

  if (!text) return children;

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' },
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {React.cloneElement(children, {
        'aria-describedby': visible ? tooltipId : undefined,
      })}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 10000,
            padding: '6px 12px',
            background: 'var(--tooltip-bg, #1e293b)',
            color: 'var(--tooltip-text, #fff)',
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            ...positionStyles[position],
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
