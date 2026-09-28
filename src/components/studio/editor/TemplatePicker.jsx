/**
 * TemplatePicker — Choose a template when creating a new course.
 * Shows available templates with previews.
 */
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import './TemplatePicker.css';

export default function TemplatePicker({ lang = 'ht', onSelect }) {
  const isHt = lang === 'ht';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/api/courses/templates/');
      setTemplates(res.data.templates || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (key) => {
    if (onSelect) onSelect(key);
  };

  if (loading) return <div className="tp-loading">Chaje modèl...</div>;

  return (
    <div className="template-picker">
      <h3>📝 {isHt ? 'Chwazi yon Modèl' : 'Choose a Template'}</h3>
      <p className="tp-subtitle">
        {isHt
          ? 'Chwazi yon modèl pou kòmanse, oswa kòmanse ak yon kou vid.'
          : 'Pick a template to start, or begin with a blank course.'}
      </p>
      <div className="tp-grid">
        {templates.map((t) => (
          <button key={t.key} className="tp-card" onClick={() => handleSelect(t.key)}>
            <span className="tp-icon">{t.icon}</span>
            <h4 className="tp-name">{isHt ? t.name : t.name_en}</h4>
            <p className="tp-desc">{isHt ? t.description : t.description_en}</p>
            <div className="tp-meta">
              <span>{t.module_count} {isHt ? 'modil' : 'modules'}</span>
              <span className={`tp-diff tp-diff-${t.difficulty}`}>{t.difficulty}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
