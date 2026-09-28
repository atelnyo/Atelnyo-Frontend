/**
 * src/components/learning/CourseAIChat.jsx
 *
 * AI-powered learning assistant embedded in the CurriculumPlayer.
 * Students can ask questions about the current lesson content and
 * get instant, contextual answers.
 *
 * Features:
 *   - Context-aware: knows which course/lesson/module the student is on
 *   - Quick questions: pre-built questions for common needs
 *   - Markdown rendering for AI responses
 *   - Typing indicator
 *   - Conversation history (session-only)
 *   - Minimizable panel (doesn't block content)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiWorkerService } from '../../services/api';

// ─── Quick question templates ─────────────────────────────────────
const QUICK_QUESTIONS = {
  ht: [
    { icon: 'fa-lightbulb', text: 'Explike m sa a an plis detay', key: 'explain' },
    { icon: 'fa-code', text: 'Ban m yon egzanp', key: 'example' },
    { icon: 'fa-question-circle', text: 'Kisa sa a ye egzakteman?', key: 'what' },
    { icon: 'fa-brain', text: 'Ki fason mwen ka sonje sa?', key: 'memory' },
  ],
  en: [
    { icon: 'fa-lightbulb', text: 'Explain this in more detail', key: 'explain' },
    { icon: 'fa-code', text: 'Give me an example', key: 'example' },
    { icon: 'fa-question-circle', text: 'What exactly is this?', key: 'what' },
    { icon: 'fa-brain', text: 'How can I remember this?', key: 'memory' },
  ],
};

// ─── Component ────────────────────────────────────────────────────
export default function CourseAIChat({
  courseTitle = '',
  moduleTitle = '',
  lessonTitle = '',
  blockContent = '',
  lang = 'ht',
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Build context for AI
  const buildContext = useCallback(() => {
    let ctx = `Ou se yon asistan aprantisaj pou kou "{courseTitle}". `;
    if (moduleTitle) ctx += `Modil aktyèl la se "{moduleTitle}". `;
    if (lessonTitle) ctx += `Leson aktyèl la se "{lessonTitle}". `;
    if (blockContent) {
      // Truncate content to avoid token limits
      const truncated = blockContent.slice(0, 1500);
      ctx += `Kontni aktyèl la:\n---\n${truncated}\n---\n`;
    }
    ctx += `Reponn nan ${isHt ? 'kreyòl ayisyen' : 'English'}. Soye klè, kout, ak edikatif. Si ou pa sèten, di sa.`;
    return ctx;
  }, [courseTitle, moduleTitle, lessonTitle, blockContent, isHt]);

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
      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      console.error('[CourseAIChat]', err);
      setError(isHt ? 'Erè lè ap reponn. Eseye ankò.' : 'Error responding. Try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, buildContext, lang, isHt]);

  // Quick question handler
  const handleQuickQuestion = useCallback((key) => {
    const templates = {
      explain: isHt
        ? `Explike m "${lessonTitle || moduleTitle}" an plis detay an kreyòl klè.`
        : `Explain "${lessonTitle || moduleTitle}" in more detail in clear English.`,
      example: isHt
        ? `Ban m yon egzanp pratik de "${lessonTitle || moduleTitle}".`
        : `Give me a practical example of "${lessonTitle || moduleTitle}".`,
      what: isHt
        ? `Kisa "${lessonTitle || moduleTitle}" ye egzakteman? Bay mwen yon definisyon klè.`
        : `What exactly is "${lessonTitle || moduleTitle}"? Give me a clear definition.`,
      memory: isHt
        ? `Ki fason mwen ka sonje "${lessonTitle || moduleTitle}" pi fasil? Bay mwen yon teknik.`
        : `How can I remember "${lessonTitle || moduleTitle}" more easily? Give me a technique.`,
    };
    handleSend(templates[key] || question);
  }, [lessonTitle, moduleTitle, isHt, handleSend]);

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
      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      color: '#fff',
      fontSize: '1.3rem',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s',
    },
    panel: {
      position: 'absolute',
      bottom: 64,
      right: 0,
      width: 380,
      maxHeight: 520,
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
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '0.85rem',
    },
    headerText: { flex: 1 },
    headerTitle: { fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' },
    headerSub: { fontSize: '0.68rem', color: '#94a3b8' },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      fontSize: '0.9rem',
      padding: 4,
    },
    messages: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxHeight: 320,
    },
    msg: (isUser) => ({
      maxWidth: '85%',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      padding: '8px 12px',
      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      background: isUser ? '#3b82f6' : '#1e293b',
      color: isUser ? '#fff' : '#e2e8f0',
      fontSize: '0.82rem',
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }),
    quickBar: {
      padding: '8px 12px',
      borderTop: '1px solid #1e293b',
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
    },
    quickBtn: {
      flexShrink: 0,
      padding: '5px 10px',
      borderRadius: 8,
      border: '1px solid #334155',
      background: 'transparent',
      color: '#94a3b8',
      fontSize: '0.72rem',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    },
    inputBar: {
      padding: '8px 12px',
      borderTop: '1px solid #1e293b',
      display: 'flex',
      gap: 8,
    },
    input: {
      flex: 1,
      padding: '8px 12px',
      borderRadius: 10,
      border: '1px solid #334155',
      background: '#1e293b',
      color: '#e2e8f0',
      fontSize: '0.82rem',
      outline: 'none',
      fontFamily: 'inherit',
    },
    sendBtn: {
      padding: '8px 14px',
      borderRadius: 10,
      border: 'none',
      background: loading ? '#475569' : '#3b82f6',
      color: '#fff',
      cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: '0.82rem',
      fontWeight: 600,
      fontFamily: 'inherit',
    },
    typing: {
      fontSize: '0.75rem',
      color: '#94a3b8',
      padding: '4px 0',
    },
    error: {
      fontSize: '0.75rem',
      color: '#ef4444',
      padding: '4px 0',
    },
  };

  return (
    <div style={S.container}>
      {/* Panel */}
      {open && (
        <div style={S.panel}>
          {/* Header */}
          <div style={S.header}>
            <div style={S.headerIcon}>
              <i className="fas fa-robot" />
            </div>
            <div style={S.headerText}>
              <div style={S.headerTitle}>
                {isHt ? 'Asistan Aprantisaj' : 'Learning Assistant'}
              </div>
              <div style={S.headerSub}>
                {courseTitle || (isHt ? 'Poze m yon kesyon' : 'Ask me a question')}
              </div>
            </div>
            <button style={S.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>

          {/* Messages */}
          <div style={S.messages}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', padding: 20 }}>
                <i className="fas fa-graduation-cap" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block' }} />
                {isHt
                  ? 'Poze m yon kesyon sou sa w ap aprann la!'
                  : 'Ask me a question about what you\'re learning!'}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={S.msg(msg.role === 'user')}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={S.typing}>
                <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap panse...' : 'Thinking...'}
              </div>
            )}
            {error && <div style={S.error}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length === 0 && (
            <div style={S.quickBar}>
              {QUICK_QUESTIONS[isHt ? 'ht' : 'en'].map((q) => (
                <button
                  key={q.key}
                  style={S.quickBtn}
                  onClick={() => handleQuickQuestion(q.key)}
                >
                  <i className={`fas ${q.icon}`} style={{ marginRight: 4 }} />
                  {q.text}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={S.inputBar}>
            <input
              ref={inputRef}
              style={S.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isHt ? 'Tape kesyon ou...' : 'Type your question...'}
              disabled={loading}
            />
            <button
              style={S.sendBtn}
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        style={S.toggle}
        onClick={() => setOpen(!open)}
        aria-label={isHt ? 'Ouvri asistan AI' : 'Open AI assistant'}
      >
        <i className={`fas ${open ? 'fa-times' : 'fa-robot'}`} />
      </button>
    </div>
  );
}
