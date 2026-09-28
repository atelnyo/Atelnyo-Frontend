/**
 * MentorChat — AI Mentor chat interface.
 *
 * Allows users to ask questions to the DEIE AI Mentor and
 * receive personalized guidance based on their profile.
 *
 * Features:
 * - Chat bubbles with question/answer
 * - Pre-defined quick actions
 * - Loading states with typing indicator
 * - Error handling with retry
 */
import React, { useState, useRef, useEffect } from 'react';
import { askMentor, getMentorLearningPath, getMentorCareerAdvice, getMentorSkillGaps } from '../../services/deie';

const QUICK_ACTIONS = [
  { key: 'learning', icon: 'fa-graduation-cap', label: { en: 'Learning Path', ht: 'Chimen Aprantisaj' }, action: 'learning-path' },
  { key: 'career', icon: 'fa-briefcase', label: { en: 'Career Advice', ht: 'Konsey Karyè' }, action: 'career-advice' },
  { key: 'skills', icon: 'fa-tools', label: { en: 'Skill Gaps', ht: 'Konpetans ki manke' }, action: 'skill-gaps' },
];

export default function MentorChat({ lang = 'ht', className = '' }) {
  const isHt = lang === 'ht';
  const [messages, setMessages] = useState([
    { role: 'mentor', text: isHt ? 'Bonjou! Mwen se mentò ou. Poze m yon kesyon oswa chwazi yon aksyon rapid.' : 'Hello! I am your AI mentor. Ask me a question or choose a quick action.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setError(null);
    addMessage('user', question);
    setLoading(true);

    try {
      const res = await askMentor(question);
      addMessage('mentor', res.data.answer || (isHt ? 'M pa kapab repon kounye a.' : 'I cannot answer right now.'));
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to get response';
      setError(errMsg);
      addMessage('mentor', isHt ? 'Mwen gen yon pwoblèm. Eseye ankò.' : 'I encountered a problem. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const labels = {
      'learning-path': isHt ? 'Montre m chimen aprantisaj mwen' : 'Show my learning path',
      'career-advice': isHt ? 'Ban m konsey karyè' : 'Give me career advice',
      'skill-gaps': isHt ? 'Ki konpetans ki manke m' : 'What skills am I missing?',
    };

    addMessage('user', labels[action] || action);

    try {
      let res;
      if (action === 'learning-path') res = await getMentorLearningPath();
      else if (action === 'career-advice') res = await getMentorCareerAdvice();
      else if (action === 'skill-gaps') res = await getMentorSkillGaps();

      const answer = res?.data?.recommendation || res?.data?.message ||
        (isHt ? 'Pa gen enfòmasyon disponib.' : 'No information available.');
      addMessage('mentor', answer);
    } catch (err) {
      setError(err.message);
      addMessage('mentor', isHt ? 'Mwen pa ka jwenn enfòmasyon sa a kounye a.' : 'I cannot get this information right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`mentor-chat ${className}`}>
      <div className="mentor-chat-header">
        <i className="fas fa-robot" />
        <h3>{isHt ? 'Mentò AI' : 'AI Mentor'}</h3>
      </div>

      {/* Quick actions */}
      <div className="mentor-quick-actions">
        {QUICK_ACTIONS.map(action => (
          <button key={action.key} className="mentor-quick-btn" onClick={() => handleQuickAction(action.action)}
                  disabled={loading}>
            <i className={`fas ${action.icon}`} />
            <span>{isHt ? action.label.ht : action.label.en}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="mentor-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`mentor-message mentor-${msg.role}`}>
            <div className="mentor-avatar">
              <i className={`fas ${msg.role === 'mentor' ? 'fa-robot' : 'fa-user'}`} />
            </div>
            <div className="mentor-bubble">{msg.text}</div>
          </div>
        ))}

        {loading && (
          <div className="mentor-message mentor-mentor">
            <div className="mentor-avatar"><i className="fas fa-robot" /></div>
            <div className="mentor-bubble mentor-typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="mentor-error" role="alert">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mentor-input-area">
        <input type="text" className="mentor-input" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isHt ? 'Poze yon kesyon...' : 'Ask a question...'}
          disabled={loading} />
        <button className="mentor-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          <i className="fas fa-paper-plane" />
        </button>
      </div>
    </div>
  );
}
