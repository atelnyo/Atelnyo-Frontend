/**
 * src/components/studio/editor/AIAssistPanel.jsx
 *
 * Creator Studio AI Assist panel — provides AI-powered content generation
 * tools for course creators. All AI-generated content is clearly marked
 * and requires creator approval before being saved.
 *
 * Features:
 *   - Generate lesson outline from topic
 *   - Generate quiz questions from content
 *   - Generate FAQ from course content
 *   - Improve/rewrite text (clearer, more examples, shorter, etc.)
 *   - Translate content to other languages
 *   - Suggest course tags
 *
 * Security: AI output is NEVER auto-saved. Creator must explicitly
 * approve every AI-generated piece before it enters the course.
 */
import React, { useState, useCallback } from 'react';
import { aiService } from '../../../services/api';
import styles from './editor.module.css';

const AI_TOOLS = [
  {
    id: 'outline',
    icon: 'fa-list-check',
    label: { ht: 'Lyèson', en: 'Outline' },
    description: { ht: 'Jenere yon plan leson depi yon sijè', en: 'Generate a lesson plan from a topic' },
  },
  {
    id: 'quiz',
    icon: 'fa-clipboard-question',
    label: { ht: 'Kiz', en: 'Quiz' },
    description: { ht: 'Jenere kesyon kiz depi kontni', en: 'Generate quiz questions from content' },
  },
  {
    id: 'faq',
    icon: 'fa-circle-question',
    label: { ht: 'FAQ', en: 'FAQ' },
    description: { ht: 'Jenere kesyon komen ak repons', en: 'Generate common questions and answers' },
  },
  {
    id: 'improve',
    icon: 'fa-wand-magic-sparkles',
    label: { ht: 'Amelyore', en: 'Improve' },
    description: { ht: 'Amelyore oswa ekspande tèks la', en: 'Improve or expand the text' },
  },
  {
    id: 'translate',
    icon: 'fa-language',
    label: { ht: 'Tradui', en: 'Translate' },
    description: { ht: 'Tradui kontni nan yon lòt lang', en: 'Translate content to another language' },
  },
  {
    id: 'tags',
    icon: 'fa-tags',
    label: { ht: 'Tags', en: 'Tags' },
    description: { ht: 'Sijere tags pou kou a', en: 'Suggest tags for the course' },
  },
];

const IMPROVE_GOALS = [
  { value: 'clearer', label: { ht: 'Pi klè', en: 'Clearer' } },
  { value: 'more_examples', label: { ht: 'Plis egzanp', en: 'More examples' } },
  { value: 'shorter', label: { ht: 'Pi kout', en: 'Shorter' } },
  { value: 'detailed', label: { ht: 'Plis detay', en: 'More detailed' } },
  { value: 'beginner_friendly', label: { ht: 'Pi fasil pou kòmanse', en: 'Beginner friendly' } },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ht', label: 'Kreyòl' },
];

export default function AIAssistPanel({ lang = 'ht', onInsertContent, currentContent = '' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [activeTool, setActiveTool] = useState(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [improveGoal, setImproveGoal] = useState('clearer');
  const [targetLang, setTargetLang] = useState('en');
  const [quizCount, setQuizCount] = useState(5);
  const [faqCount, setFaqCount] = useState(5);

  const handleGenerate = useCallback(async () => {
    if (!activeTool || !input.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      let res;
      switch (activeTool) {
        case 'outline':
          res = await aiService.generateLessonOutline(input);
          break;
        case 'quiz':
          res = await aiService.generateQuizQuestions(input, quizCount);
          break;
        case 'faq':
          res = await aiService.generateFaq(input, faqCount);
          break;
        case 'improve':
          res = await aiService.improveText(input, improveGoal);
          break;
        case 'translate':
          res = await aiService.translateContent(input, targetLang);
          break;
        case 'tags':
          res = await aiService.suggestTags(input);
          break;
        default:
          return;
      }
      setOutput(res?.data?.text || res?.data?.error || '');
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || t('AI request failed.', 'Demann AI echwe.'));
    } finally {
      setLoading(false);
    }
  }, [activeTool, input, improveGoal, targetLang, quizCount, faqCount, t, isHt]);

  const handleInsert = useCallback(() => {
    if (output && onInsertContent) {
      onInsertContent(output);
    }
  }, [output, onInsertContent]);

  const resetPanel = useCallback(() => {
    setActiveTool(null);
    setInput('');
    setOutput('');
    setError('');
  }, []);

  return (
    <div style={{
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 12,
      background: 'rgba(139,92,246,0.03)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(139,92,246,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <i className="fas fa-wand-magic-sparkles" style={{ color: '#8b5cf6' }} />
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
          {t('AI Assist', 'AI Asistan')}
        </span>
        <span style={{
          fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
          background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 600,
        }}>
          BETA
        </span>
      </div>

      {/* Tool selection */}
      {!activeTool && (
        <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {AI_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              style={{
                padding: '8px 6px', borderRadius: 8, border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-elevated, #1e293b)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontSize: '0.72rem', fontFamily: 'inherit', color: 'var(--text)',
              }}
            >
              <i className={`fas ${tool.icon}`} style={{ color: '#8b5cf6', fontSize: '1rem' }} />
              <span style={{ fontWeight: 600 }}>{tool.label[lang] || tool.label.en}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tool form */}
      {activeTool && (
        <div style={{ padding: 12 }}>
          {/* Back button */}
          <button
            type="button"
            onClick={resetPanel}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
            }}
          >
            <i className="fas fa-arrow-left" /> {t('Retounen', 'Back')}
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            {AI_TOOLS.find((t) => t.id === activeTool)?.description[lang] || ''}
          </p>

          {/* Tool-specific options */}
          {activeTool === 'improve' && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {IMPROVE_GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setImproveGoal(g.value)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem',
                    border: `1px solid ${improveGoal === g.value ? '#8b5cf6' : 'var(--border-color)'}`,
                    background: improveGoal === g.value ? 'rgba(139,92,246,0.1)' : 'transparent',
                    color: improveGoal === g.value ? '#8b5cf6' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: improveGoal === g.value ? 600 : 400,
                  }}
                >
                  {g.label[lang] || g.label.en}
                </button>
              ))}
            </div>
          )}

          {activeTool === 'translate' && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setTargetLang(l.code)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem',
                    border: `1px solid ${targetLang === l.code ? '#8b5cf6' : 'var(--border-color)'}`,
                    background: targetLang === l.code ? 'rgba(139,92,246,0.1)' : 'transparent',
                    color: targetLang === l.code ? '#8b5cf6' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {activeTool === 'quiz' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.75rem' }}>
              <label style={{ color: 'var(--text-secondary)' }}>{t('Kesyon:', 'Questions:')}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={quizCount}
                onChange={(e) => setQuizCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                style={{
                  width: 50, padding: '4px 6px', borderRadius: 6,
                  border: '1px solid var(--border-color)', background: 'transparent',
                  color: 'var(--text)', fontSize: '0.75rem', textAlign: 'center',
                }}
              />
            </div>
          )}

          {activeTool === 'faq' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.75rem' }}>
              <label style={{ color: 'var(--text-secondary)' }}>{t('FAQ:', 'FAQs:')}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={faqCount}
                onChange={(e) => setFaqCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                style={{
                  width: 50, padding: '4px 6px', borderRadius: 6,
                  border: '1px solid var(--border-color)', background: 'transparent',
                  color: 'var(--text)', fontSize: '0.75rem', textAlign: 'center',
                }}
              />
            </div>
          )}

          {/* Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeTool === 'outline' ? t('Egzanp: "Variables ak Tip Done nan Python"', 'e.g. "Variables and Data Types in Python"')
              : activeTool === 'tags' ? t('Tit kou a', 'Course title')
              : t('Antre kontni a isit la...', 'Enter content here...')
            }
            rows={activeTool === 'tags' ? 2 : 4}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--bg, #0f172a)', color: 'var(--text)',
              fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical',
              lineHeight: 1.5, marginBottom: 8,
            }}
          />

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !input.trim()}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
              background: loading ? '#666' : '#8b5cf6',
              color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
            {loading ? t('Ap jenere...', 'Generating...') : t('Jenere', 'Generate')}
          </button>

          {error && (
            <p style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem' }}>
              <i className="fas fa-circle-exclamation" /> {error}
            </p>
          )}

          {/* Output */}
          {output && (
            <div style={{ marginTop: 12 }}>
              {/* AI-generated badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                fontSize: '0.7rem', color: '#8b5cf6',
              }}>
                <i className="fas fa-robot" />
                <span style={{ fontWeight: 600 }}>{t('AI-jenere — verifye anvan w sove', 'AI-generated — review before saving')}</span>
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-elevated, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                fontSize: '0.8rem', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto',
                color: 'var(--text)',
              }}>
                {output}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleInsert}
                  style={{
                    flex: 1, padding: '7px 12px', borderRadius: 8, border: 'none',
                    background: '#10b981', color: '#fff', fontWeight: 600,
                    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <i className="fas fa-plus" /> {t('Ajoute nan leson', 'Insert into lesson')}
                </button>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(output); }}
                  style={{
                    padding: '7px 12px', borderRadius: 8,
                    border: '1px solid var(--border-color, #334155)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                  }}
                >
                  <i className="fas fa-copy" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
