/**
 * MediaProjectFormModal — Modal form to create a Project.
 *
 * Fields:
 *   - Name        (required, 1-60 chars)
 *   - Description (optional, up to 240 chars)
 *   - Color       (4 presets + free color)
 *
 * Calls onSubmit({ name, description, color }) on success.
 */
import React, { useState, useCallback, useEffect } from 'react';

const COLOR_PRESETS = [
  { id: 'rose',    hex: '#d81b60' },
  { id: 'violet',  hex: '#7c3aed' },
  { id: 'teal',    hex: '#0d9488' },
  { id: 'amber',   hex: '#d97706' },
];

function ColorDot({ hex, selected, onClick, label }) {
  return (
    <button
      type="button"
      className={`project-form-color-dot ${selected ? 'project-form-color-dot-selected' : ''}`}
      onClick={onClick}
      style={{ backgroundColor: hex }}
      aria-label={label}
      aria-pressed={selected ? 'true' : 'false'}
    />
  );
}

export default function MediaProjectFormModal({
  lang = 'ht',
  onClose,
  onSubmit,
  showToast,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#d81b60');

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose && onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = name.trim().length > 0 && name.trim().length <= 60;

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!valid) {
      if (showToast) showToast(
        lang === 'en' ? 'Enter a project name (1–60 chars).' : 'Antre yon non pwojè (1–60 karaktè).',
        'exclamation-triangle',
      );
      return;
    }
    if (description.length > 240) {
      if (showToast) showToast(
        lang === 'en' ? 'Description max 240 chars.' : 'Deskripsyon maks 240 karaktè.',
        'exclamation-triangle',
      );
      return;
    }
    onSubmit && onSubmit({
      name: name.trim(),
      description: description.trim(),
      color,
    });
  }, [valid, name, description, color, onSubmit, showToast, lang]);

  return (
    <div className="modal-overlay" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Add Project' : 'Ajoute Pwojè'}>
      <form className="modal-card project-form" onSubmit={handleSubmit}>
        <header className="modal-card-header">
          <h3>{lang === 'en' ? 'Add Project' : 'Ajoute Pwojè'}</h3>
          <button
            type="button"
            className="modal-card-close"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : 'Fèmen'}
          >
            <i className="fas fa-xmark" />
          </button>
        </header>

        <div className="modal-card-body">
          <label className="form-field">
            <span className="form-field-label">
              {lang === 'en' ? 'Name' : 'Non'} <span aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'en' ? 'e.g. React Course' : 'eg. Kou React'}
              autoFocus
              className="form-field-input"
              required
            />
          </label>

          <label className="form-field">
            <span className="form-field-label">
              {lang === 'en' ? 'Description (optional)' : 'Deskripsyon (opsyonèl)'}
            </span>
            <textarea
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={lang === 'en' ? 'What is this project for?' : 'Kisa pwojè sa a ye?'}
              className="form-field-input"
            />
            <span className="form-field-hint">
              {description.length}/240
            </span>
          </label>

          <div className="form-field">
            <span className="form-field-label">
              {lang === 'en' ? 'Color' : 'Koulè'}
            </span>
            <div className="project-form-color-list">
              {COLOR_PRESETS.map((c) => (
                <ColorDot
                  key={c.id}
                  hex={c.hex}
                  selected={color === c.hex}
                  onClick={() => setColor(c.hex)}
                  label={c.id}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="modal-card-footer">
          <button type="button" className="btn-action" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'Anile'}
          </button>
          <button
            type="submit"
            className="btn-action btn-action-primary"
            disabled={!valid}
            aria-disabled={!valid ? 'true' : 'false'}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            <span>{lang === 'en' ? 'Add Project' : 'Ajoute Pwojè'}</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
