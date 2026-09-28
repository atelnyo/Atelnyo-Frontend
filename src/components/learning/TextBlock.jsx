/**
 * src/components/learning/TextBlock.jsx
 *
 * Lesson content — READING (any subject): the learner reads the lesson
 * paragraphs and confirms completion.
 *
 * Now renders inline markdown: **bold**, *italic*, `code`, headings (#),
 * numbered lists (1. item), and bullet lists (- item).
 */
import React, { useState, useMemo } from 'react';
import styles from './learning.module.css';

/**
 * Parse a single line of inline markdown into React elements.
 * Handles: **bold**, *italic*, `code`, ~strikethrough~.
 */
function parseInline(text) {
  if (!text) return null;
  // Split on markdown patterns: **bold**, *italic*, `code`, ~strike~, [link](url)
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~(.+?)~|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={match.index} style={{
          background: 'rgba(148,163,184,0.15)',
          padding: '1px 5px',
          borderRadius: 4,
          fontSize: '0.9em',
          fontFamily: 'monospace',
        }}>
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      // ~strikethrough~
      parts.push(<s key={match.index}>{match[5]}</s>);
    } else if (match[6] && match[7]) {
      // [link text](url) — Phase 10: accessible external links
      const isExternal = /^https?:\/\//.test(match[7]);
      parts.push(
        <a
          key={match.index}
          href={match[7]}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          style={{
            color: 'var(--color-primary, #d81b60)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {match[6]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

/**
 * Determine if a line is a heading (# Title, ## Subtitle, etc.)
 */
function parseHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.+)/);
  if (!match) return null;
  return { level: match[1].length, text: match[2] };
}

/**
 * Determine if a line is a blockquote (> text)
 */
function parseBlockquote(line) {
  const match = line.match(/^>\s*(.*)/);
  if (!match) return null;
  return match[1];
}

/**
 * Determine if a line is a list item (- item or * item)
 */
function parseBullet(line) {
  const match = line.match(/^[\-\*]\s+(.+)/);
  if (!match) return null;
  return match[1];
}

/**
 * Determine if a line is a numbered list item (1. item)
 */
function parseNumbered(line) {
  const match = line.match(/^\d+\.\s+(.+)/);
  if (!match) return null;
  return match[1];
}

/**
 * Render a single paragraph block — handles headings, lists, and plain text.
 */
function ParagraphBlock({ text, index }) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Check for heading
  const heading = parseHeading(trimmed);
  if (heading) {
    const Tag = `h${Math.min(heading.level + 1, 6)}`; // h2-h6 (h1 is reserved)
    return (
      <Tag className={styles.practiceContentParagraph} style={{
        fontWeight: 700,
        marginTop: heading.level <= 2 ? '1.2em' : '0.8em',
        marginBottom: '0.4em',
        lineHeight: 1.3,
      }}>
        {parseInline(heading.text)}
      </Tag>
    );
  }

  // Check for blockquote (> text)
  const firstBlockquote = parseBlockquote(trimmed);
  if (firstBlockquote !== null) {
    // Collect consecutive blockquote lines
    const bqLines = trimmed.split('\n').filter((l) => parseBlockquote(l) !== null);
    const bqText = bqLines.map((l) => parseBlockquote(l)).join(' ');
    return (
      <blockquote
        style={{
          margin: '0.8em 0',
          padding: '12px 16px',
          borderLeft: '3px solid var(--color-primary, #3b82f6)',
          background: 'rgba(59, 130, 246, 0.04)',
          borderRadius: '0 8px 8px 0',
          fontStyle: 'italic',
          color: 'var(--text-secondary, #4b5563)',
          lineHeight: 1.6,
          fontSize: '0.92em',
        }}
      >
        {parseInline(bqText)}
      </blockquote>
    );
  }

  // Check if this is a list (bullet or numbered)
  const lines = trimmed.split('\n');
  const firstBullet = parseBullet(lines[0]);
  const firstNumbered = parseNumbered(lines[0]);
  const isBulletList = firstBullet !== null;
  const isNumberedList = firstNumbered !== null;

  if (isBulletList || isNumberedList) {
    const ListTag = isNumberedList ? 'ol' : 'ul';
    return (
      <ListTag style={{
        margin: '0.5em 0',
        paddingLeft: '1.5em',
      }}>
        {lines.map((line, i) => {
          const bulletText = isBulletList ? parseBullet(line) : parseNumbered(line);
          if (bulletText === null) {
            // Not a list item — render as a paragraph inside the list
            return <li key={i}>{parseInline(line.replace(/^[\-\*]\s+/, '').replace(/^\d+\.\s+/, ''))}</li>;
          }
          return (
            <li key={i} style={{ marginBottom: '0.3em', lineHeight: 1.6 }}>
              {parseInline(bulletText)}
            </li>
          );
        })}
      </ListTag>
    );
  }

  // Plain paragraph (with inline markdown)
  return (
    <p className={styles.practiceContentParagraph}>
      {parseInline(trimmed)}
    </p>
  );
}

export default function TextBlock({ block, lang = 'ht', reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [readDone, setReadDone] = useState(false);

  // Split content into paragraphs (double newline) and render with markdown
  const paragraphs = useMemo(() => {
    const raw = Array.isArray(block.content)
      ? block.content
      : String(block.content || '').split(/\n{2,}/);
    return raw.filter((p) => p && String(p).trim());
  }, [block.content]);

  return (
    <div className={styles.practiceContent}>
      {paragraphs.map((p, i) => (
        <ParagraphBlock key={i} text={String(p).trim()} index={i} />
      ))}
      <button
        type="button"
        className={`${styles.practiceBtn} ${readDone ? styles.practiceBtnDone : ''}`}
        onClick={() => {
          setReadDone(true);
          reportComplete();
        }}
      >
        <i className="fas fa-check" aria-hidden="true" />
        {readDone ? t('Read', 'Li') : t('I finished reading', 'M fin li')}
      </button>
    </div>
  );
}
