/**
 * src/components/studio/editor/StudioAIChat.jsx
 *
 * AI-powered chatbot for Creator Studio. Helps course creators:
 *   - Generate course outlines and lesson plans
 *   - Write content (text, descriptions, objectives)
 *   - Create quiz questions and exercises
 *   - Improve existing content
 *   - Translate content
 *   - Get suggestions for tags, categories, pricing
 *
 * The chatbot is context-aware: it knows the current course form state
 * and can generate content that fits the course.
 *
 * All AI output requires explicit creator approval before being saved.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiWorkerService } from '../../../services/api';

// ─── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = {
  ht: `Ou se Asistan Kreyatè Atelnyo. Ou ede kreyatè kou kreye ak amelyore kontni.
Ou gen konesans sou:
- Kreye plan leson ak modil
- Ekri deskripsyon kou ki atire
- Kreye kesyon kiz ak egzèsis
- Amelyore tèks (plis klè, plis egzanp, pi kout)
- Sijere tags ak kategori
- Estrateji pri ak mache

Règ:
- Toujou ekri nan lang ou mande a (kreyòl oswa angle)
- Bay egzanp konkret, pa abstrè
- Si yon kreyatè mande yon bagay ki pa nan domèn ou, di sa
- Pa janm envante done reyèl (pri, done, elatriye)`,
  en: `You are the Atelnyo Creator Assistant. You help course creators build and improve content.
You have expertise in:
- Creating lesson plans and modules
- Writing compelling course descriptions
- Creating quiz questions and exercises
- Improving text (clearer, more examples, shorter)
- Suggesting tags and categories
- Pricing and marketing strategies

Rules:
- Always write in the requested language
- Give concrete examples, not abstract ones
- If a creator asks something outside your domain, say so
- Never invent real data (prices, stats, etc.)`,
};

// ─── Suggested prompts ────────────────────────────────────────────
const SUGGESTIONS = {
  ht: [
    { icon: 'fa-list-check', text: 'Jenere yon plan pou kou sou Python' },
    { icon: 'fa-clipboard-question', text: 'Kreye 5 kesyon kiz sou OOP' },
    { icon: 'fa-wand-magic-sparkles', text: 'Amelyore deskripsyon kou sa a' },
    { icon: 'fa-tags', text: 'Sijere tags pou yon kou mizik' },
    { icon: 'fa-dollar-sign', text: 'Ki jan pou pri yon kou $20?' },
    { icon: 'fa-language', text: 'Tradwi deskripsyon sa a nan angle' },
  ],
  en: [
    { icon: 'fa-list-check', text: 'Generate a plan for a Python course' },
    { icon: 'fa-clipboard-question', text: 'Create 5 quiz questions on OOP' },
    { icon: 'fa-wand-magic-sparkles', text: 'Improve this course description' },
    { icon: 'fa-tags', text: 'Suggest tags for a music course' },
    { icon: 'fa-dollar-sign', text: 'How should I price a $20 course?' },
    { icon: 'fa-language', text: 'Translate this description to Creole' },
  ],
};

// ─── Component ────────────────────────────────────────────────────
export default function StudioAIChat({
  courseForm = null,
  lang = 'ht',
  onInsertContent = null, // callback(content) to insert AI output into form
  style = {},
}) {
  const isHt = lang === 'ht';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Build context from course form
  const buildContext = useCallback(() => {
    let ctx = SYSTEM_PROMPT[isHt ? 'ht' : 'en'] + '\n\n';
    if (courseForm) {
      ctx += '--- KOU AKTYÈL LA ---\n';
      if (courseForm.title) ctx += `Tit: ${courseForm.title}\n`;
      if (courseForm.description) ctx += `Deskripsyon: ${courseForm.description.slice(0, 500)}\n`;
      if (courseForm.category) ctx += `Kategori: ${courseForm.category}\n`;
      if (courseForm.difficulty) ctx += `Nivo: ${courseForm.difficulty}\n`;
      if (courseForm.price) ctx += `Pri: $${courseForm.price}\n`;
      if (courseForm.objectives) ctx += `Objektif: ${courseForm.objectives}\n`;
      if (courseForm.modules?.length) {
        ctx += `Modil (${courseForm.modules.length}):\n`;
        courseForm.modules.forEach((m, i) => {
          ctx += `  ${i + 1}. ${m.title || 'Sans tit'}\n`;
          if (m.description) ctx += `     ${m.description.slice(0, 100)}\n`;
        });
      }
      ctx += '--- FIN KOU ---\n\n';
    }
    return ctx;
  }, [courseForm, isHt]);

  // Send message
  const handleSend = useCallback(async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const systemInstruction = buildContext();
      // aiWorkerService.chat takes a single options object — passing the
      // question positionally left `prompt` undefined and the Worker always
      // replied 400 "prompt is required."
      const res = await aiWorkerService.chat({
        prompt: question,
        system_instruction: systemInstruction,
        lang,
      });
      const answer = res?.data?.text || res?.text || (isHt ? 'M pa kapab repon kounye a.' : 'I cannot answer right now.');
      setMessages(prev => [...prev, { role: 'assistant', text: answer, insertable: true }]);
    } catch (err) {
      console.error('[StudioAIChat]', err);
      setError(isHt ? 'Erè. Eseye ankò.' : 'Error. Try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, buildContext, lang, isHt]);

  // Insert AI content into form
  const handleInsert = useCallback((text) => {
    if (onInsertContent) {
      onInsertContent(text);
    }
  }, [onInsertContent]);

  // ─── Styles ──────────────────────────────────────────────────
  const S = {
    container: {
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9000,
      fontFamily: "'Inter', -apple-system, sans-serif",
      ...style,
    },
    toggle: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: 'none',
      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      color: '#fff',
      fontSize: '1.3rem',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    panel: {
      position: 'absolute',
      bottom: 64,
      right: 0,
      width: 420,
      maxHeight: 560,
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    },
    header: {
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    headerIcon: {
      width: 32, height: 32, borderRadius: '50%',
      background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: '0.85rem',
    },
    headerText: { flex: 1 },
    headerTitle: { fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' },
    headerSub: { fontSize: '0.68rem', color: '#94a3b8' },
    closeBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', padding: 4 },
    messages: {
      flex: 1, overflowY: 'auto', padding: '12px',
      display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340,
    },
    msg: (isUser) => ({
      maxWidth: '88%', alignSelf: isUser ? 'flex-end' : 'flex-start',
      padding: '8px 12px',
      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      background: isUser ? '#8b5cf6' : '#1e293b',
      color: isUser ? '#fff' : '#e2e8f0',
      fontSize: '0.82rem', lineHeight: 1.5,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }),
    insertBtn: {
      marginTop: 6, padding: '4px 10px', borderRadius: 6,
      border: '1px solid #3b82f6', background: 'transparent',
      color: '#3b82f6', fontSize: '0.7rem', cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 600,
    },
    suggestions: {
      padding: '8px 12px', borderTop: '1px solid #1e293b',
      display: 'flex', flexWrap: 'wrap', gap: 6,
    },
    suggestBtn: {
      padding: '5px 10px', borderRadius: 8,
      border: '1px solid #334155', background: 'transparent',
      color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
    },
    inputBar: { padding: '8px 12px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8 },
    input: {
      flex: 1, padding: '8px 12px', borderRadius: 10,
      border: '1px solid #334155', background: '#1e293b',
      color: '#e2e8f0', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
    },
    sendBtn: {
      padding: '8px 14px', borderRadius: 10, border: 'none',
      background: loading ? '#475569' : '#8b5cf6',
      color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
    },
    typing: { fontSize: '0.75rem', color: '#94a3b8', padding: '4px 0' },
    error: { fontSize: '0.75rem', color: '#ef4444', padding: '4px 0' },
  };

  return (
    <div style={S.container}>
      {open && (
        <div style={S.panel}>
          <div style={S.header}>
            <div style={S.headerIcon}><i className="fas fa-wand-magic-sparkles" /></div>
            <div style={S.headerText}>
              <div style={S.headerTitle}>{isHt ? 'Asistan Kreyatè' : 'Creator Assistant'}</div>
              <div style={S.headerSub}>{isHt ? 'Ede ou kreye kontni pou kou ou' : 'Helps you create course content'}</div>
            </div>
            <button style={S.closeBtn} onClick={() => setOpen(false)}><i className="fas fa-times" /></button>
          </div>

          <div style={S.messages}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', padding: 20 }}>
                <i className="fas fa-wand-magic-sparkles" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block' }} />
                {isHt ? 'Mwen ka ede ou kreye ak amelyore kontni kou ou!' : 'I can help you create and improve your course content!'}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={S.msg(msg.role === 'user')}>
                {msg.text}
                {msg.insertable && onInsertContent && (
                  <button style={S.insertBtn} onClick={() => handleInsert(msg.text)}>
                    <i className="fas fa-plus" style={{ marginRight: 3 }} />
                    {isHt ? 'Enspòte nan kou a' : 'Insert into course'}
                  </button>
                )}
              </div>
            ))}
            {loading && <div style={S.typing}><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap panse...' : 'Thinking...'}</div>}
            {error && <div style={S.error}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 0 && (
            <div style={S.suggestions}>
              {SUGGESTIONS[isHt ? 'ht' : 'en'].map((s, i) => (
                <button key={i} style={S.suggestBtn} onClick={() => handleSend(s.text)}>
                  <i className={`fas ${s.icon}`} />{s.text}
                </button>
              ))}
            </div>
          )}

          <div style={S.inputBar}>
            <input
              ref={inputRef}
              style={S.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isHt ? 'Mande m yon bagay...' : 'Ask me something...'}
              disabled={loading}
            />
            <button style={S.sendBtn} onClick={() => handleSend()} disabled={loading || !input.trim()}>
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      )}

      <button style={S.toggle} onClick={() => setOpen(!open)}>
        <i className={`fas ${open ? 'fa-times' : 'fa-wand-magic-sparkles'}`} />
      </button>
    </div>
  );
}
