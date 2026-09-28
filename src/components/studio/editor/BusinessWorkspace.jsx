/**
 * src/components/studio/editor/BusinessWorkspace.jsx
 *
 * Student Business Workspace / Portfolio component.
 * Shows progress across all portfolio sections, allows saving/editing,
 * and integrates with the course learning experience.
 *
 * Sections map to course exercises:
 *   Business Idea → Problem → Opportunity → Customer → Market → etc.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import './BusinessWorkspace.css';

const PORTFOLIO_SECTIONS = [
  { key: 'business_idea', label: 'Biznis Ou', icon: '💡', description: 'Kisa ou vle fè?' },
  { key: 'problem', label: 'Pwoblèm', icon: '🔍', description: 'Ki pwoblèm ou rezoud?' },
  { key: 'opportunity', label: 'Opòtinite', icon: '🎯', description: 'Ki opòtinite ou wè?' },
  { key: 'customer_profile', label: 'Kliyan Ou', icon: '👥', description: 'Kiyès kliyan ou?' },
  { key: 'market_research', label: 'Etid Mache', icon: '📊', description: 'Kisa ou jwenn?' },
  { key: 'competition', label: 'Konpetitè', icon: '⚔️', description: 'Kiyès konpetitè ou?' },
  { key: 'value_proposition', label: 'Valè Ou', icon: '⭐', description: 'Kisa ou ofri?' },
  { key: 'business_model', label: 'Modèl Biznis', icon: '🏗️', description: 'Kijan ou fè lajan?' },
  { key: 'products_services', label: 'Pwodwi/Sèvis', icon: '📦', description: 'Kisa ou vann?' },
  { key: 'pricing', label: 'Pri', icon: '💰', description: 'Konbyen ou chaje?' },
  { key: 'startup_budget', label: 'Bidjè', icon: '🧮', description: 'Konbyen ou bezwen?' },
  { key: 'financial_plan', label: 'Plan Finans', icon: '📈', description: 'Kijan ou jere lajan?' },
  { key: 'brand', label: 'Brand', icon: '🎨', description: 'Kijan ou parèt?' },
  { key: 'marketing', label: 'Maketing', icon: '📣', description: 'Kijan ou mache?' },
  { key: 'sales', label: 'Vann', icon: '🤝', description: 'Kijan ou vann?' },
  { key: 'digital_presence', label: 'Sou Entènèt', icon: '🌐', description: 'Kote ou ye sou entènèt?' },
  { key: 'legal', label: 'Legal', icon: '📋', description: 'Dokiman ou bezwen?' },
  { key: 'risks', label: 'Risk', icon: '⚠️', description: 'Ki danje?' },
  { key: 'protection', label: 'Proteksyon', icon: '🛡️', description: 'Kijan pou pwoteje?' },
  { key: 'launch_plan', label: 'Plan Lanse', icon: '🚀', description: 'Kijan pou kòmanse?' },
];

export default function BusinessWorkspace({ courseId, user, showToast }) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null);
  const [editData, setEditData] = useState('');
  const [saving, setSaving] = useState(false);
  const [challenges, setChallenges] = useState([]);

  // Load portfolio
  useEffect(() => {
    loadPortfolio();
    loadChallenges();
  }, [courseId]);

  const loadPortfolio = async () => {
    try {
      const res = await api.get(`/api/courses/${courseId}/portfolio/`);
      setPortfolio(res.data);
    } catch (err) {
      // Portfolio doesn't exist yet — create it
      try {
        const res = await api.post(`/api/courses/${courseId}/portfolio/`);
        setPortfolio({ id: res.data.id, sections: {}, completed_sections: [], completion_percentage: 0 });
      } catch (e) {
        console.error('Failed to create portfolio:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadChallenges = async () => {
    try {
      const res = await api.get(`/api/courses/${courseId}/portfolio/challenge/`);
      setChallenges(res.data.challenges || []);
    } catch (e) {
      // Ignore
    }
  };

  const selectSection = useCallback((section) => {
    setActiveSection(section);
    const sectionData = portfolio?.sections?.[section.key];
    setEditData(sectionData?.data?.text || sectionData?.data?.content || '');
  }, [portfolio]);

  const saveSection = async () => {
    if (!activeSection) return;
    setSaving(true);
    try {
      await api.post(`/api/courses/${courseId}/portfolio/section/`, {
        section_key: activeSection.key,
        data: { text: editData, content: editData },
        completed: editData.trim().length > 10,
      });
      // Reload portfolio
      await loadPortfolio();
      if (showToast) showToast('Sove!', 'success');
    } catch (err) {
      if (showToast) showToast('Erè nan sove.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startChallenge = async (type) => {
    try {
      await api.post(`/api/courses/${courseId}/portfolio/challenge/`, {
        challenge_type: type,
      });
      await loadChallenges();
      if (showToast) showToast('Defi a kòmanse!', 'success');
    } catch (err) {
      if (showToast) showToast('Erè nan kòmanse defi a.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="bws-loading">
        <div className="bws-spinner" />
        <p>Chaje workspace ou...</p>
      </div>
    );
  }

  const completedCount = (portfolio?.completed_sections || []).length;
  const totalSections = PORTFOLIO_SECTIONS.length;
  const percentage = portfolio?.completion_percentage || 0;

  return (
    <div className="business-workspace">
      {/* Header */}
      <div className="bws-header">
        <h2>💼 Biznis Workspace Ou</h2>
        <p className="bws-subtitle">Kreye biznis ou pandan ou ap aprann</p>
        <div className="bws-progress-bar">
          <div className="bws-progress-fill" style={{ width: `${percentage}%` }} />
          <span className="bws-progress-text">{percentage}%</span>
        </div>
        <p className="bws-progress-label">{completedCount}/{totalSections} seksyon fini</p>
      </div>

      {/* Challenges */}
      {challenges.length === 0 && (
        <div className="bws-challenges">
          <h3>🎯 Defi</h3>
          <div className="bws-challenge-grid">
            <button className="bws-challenge-btn" onClick={() => startChallenge('7_day_idea')}>
              <span className="bws-challenge-icon">7️⃣</span>
              <span>7-Jou Defi Ide</span>
            </button>
            <button className="bws-challenge-btn" onClick={() => startChallenge('14_day_market')}>
              <span className="bws-challenge-icon">14️⃣</span>
              <span>14-Jou Defi Mache</span>
            </button>
            <button className="bws-challenge-btn" onClick={() => startChallenge('30_day_launch')}>
              <span className="bws-challenge-icon">30️⃣</span>
              <span>30-Jou Defi Lanse</span>
            </button>
          </div>
        </div>
      )}

      {/* Sections Grid */}
      <div className="bws-sections">
        {PORTFOLIO_SECTIONS.map((section) => {
          const isCompleted = (portfolio?.completed_sections || []).includes(section.key);
          const hasData = Boolean(portfolio?.sections?.[section.key]?.data);
          const isActive = activeSection?.key === section.key;

          return (
            <button
              key={section.key}
              className={`bws-section-card ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
              onClick={() => selectSection(section)}
            >
              <span className="bws-section-icon">{section.icon}</span>
              <span className="bws-section-label">{section.label}</span>
              {isCompleted && <span className="bws-section-check">✅</span>}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {activeSection && (
        <div className="bws-editor">
          <div className="bws-editor-header">
            <h3>{activeSection.icon} {activeSection.label}</h3>
            <p className="bws-editor-desc">{activeSection.description}</p>
          </div>
          <textarea
            className="bws-editor-input"
            value={editData}
            onChange={(e) => setEditData(e.target.value)}
            placeholder={`Ekri sa ou panse sou {activeSection.label}...`}
            rows={8}
          />
          <div className="bws-editor-actions">
            <button
              className="bws-save-btn"
              onClick={saveSection}
              disabled={saving}
            >
              {saving ? '⏳ Sove...' : '💾 Sove'}
            </button>
            <button
              className="bws-close-btn"
              onClick={() => setActiveSection(null)}
            >
              ✕ Fèmen
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bws-tips">
        <h4>💡 Konsèy</h4>
        <ul>
          <li>Pa bezwen ekri anpil — menm 2 fraz se ase</li>
          <li>Ou ka retounen amelyore kisa ou ekri pita</li>
          <li>Chak aktivite nan kou a sov otomatikman isit la</li>
          <li>Pa pè fè erè — li se pati nan aprann</li>
        </ul>
      </div>
    </div>
  );
}
