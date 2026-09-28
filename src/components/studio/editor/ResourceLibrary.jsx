/**
 * ResourceLibrary — Reusable resources for creators.
 * Upload once, use in multiple courses.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import './ResourceLibrary.css';

const RESOURCE_TYPES = [
  { key: 'image', label: '🖼️ Imaj', accept: 'image/*' },
  { key: 'video', label: '🎬 Videyo', accept: 'video/*' },
  { key: 'audio', label: '🎵 Odyo', accept: 'audio/*' },
  { key: 'document', label: '📄 Dokiman', accept: '.pdf,.doc,.docx,.txt' },
  { key: 'template', label: '📋 Modèl', accept: '' },
  { key: 'link', label: '🔗 Lyen', accept: '' },
  { key: 'embed', label: '💻 Embed', accept: '' },
];

export default function ResourceLibrary({ lang = 'ht', courseId, onInsert }) {
  const isHt = lang === 'ht';
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newResource, setNewResource] = useState({
    title: '', description: '', resource_type: 'image', url: '', tags: '',
  });

  useEffect(() => { loadResources(); }, []);

  const loadResources = async () => {
    try {
      const res = await api.get('/api/resources/');
      setResources(res.data.resources || []);
    } catch (e) {
      console.error('Failed to load resources:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/api/resources/', {
        ...newResource,
        tags: newResource.tags ? newResource.tags.split(',').map(t => t.trim()) : [],
      });
      setShowAdd(false);
      setNewResource({ title: '', description: '', resource_type: 'image', url: '', tags: '' });
      loadResources();
    } catch (e) {
      console.error('Failed to create resource:', e);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(isHt ? 'Efase resous sa a?' : 'Delete this resource?')) return;
    try {
      await api.delete(`/api/resources/${id}/`);
      loadResources();
    } catch (e) {
      console.error('Failed to delete resource:', e);
    }
  };

  const handleInsert = (resource) => {
    if (onInsert) onInsert(resource);
  };

  const filtered = filter === 'all' ? resources : resources.filter(r => r.resource_type === filter);

  return (
    <div className="resource-library">
      <div className="rl-header">
        <h3>📚 {isHt ? 'Bibliyotèk Resous' : 'Resource Library'}</h3>
        <button className="rl-add-btn" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '✕' : '+ ' + (isHt ? 'Ajoute' : 'Add')}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rl-add-form">
          <select value={newResource.resource_type}
            onChange={e => setNewResource(p => ({ ...p, resource_type: e.target.value }))}>
            {RESOURCE_TYPES.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <input placeholder={isHt ? 'Tit resous' : 'Resource title'}
            value={newResource.title}
            onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))} />
          <input placeholder={isHt ? 'URL oswa lyen' : 'URL or link'}
            value={newResource.url}
            onChange={e => setNewResource(p => ({ ...p, url: e.target.value }))} />
          <input placeholder={isHt ? 'Tags (separe ak virgul)' : 'Tags (comma separated)'}
            value={newResource.tags}
            onChange={e => setNewResource(p => ({ ...p, tags: e.target.value }))} />
          <button className="rl-save-btn" onClick={handleCreate}>
            💾 {isHt ? 'Sove' : 'Save'}
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="rl-filters">
        <button className={`rl-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}>{isHt ? 'Tout' : 'All'}</button>
        {RESOURCE_TYPES.map(t => (
          <button key={t.key}
            className={`rl-filter-btn ${filter === t.key ? 'active' : ''}`}
            onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Resources list */}
      {loading ? (
        <div className="rl-loading">Chaje...</div>
      ) : filtered.length === 0 ? (
        <div className="rl-empty">
          <p>{isHt ? 'Pa gen resous ankò.' : 'No resources yet.'}</p>
          <p>{isHt ? 'Ajoute premye resous ou pou itilize nan tout kou ou.' : 'Add your first resource to use across all your courses.'}</p>
        </div>
      ) : (
        <div className="rl-grid">
          {filtered.map(r => (
            <div key={r.id} className="rl-card">
              <div className="rl-card-type">
                {RESOURCE_TYPES.find(t => t.key === r.resource_type)?.label || r.resource_type}
              </div>
              <h4 className="rl-card-title">{r.title}</h4>
              {r.description && <p className="rl-card-desc">{r.description}</p>}
              <div className="rl-card-meta">
                {r.usage_count > 0 && <span>📊 {r.usage_count} x</span>}
                {r.tags?.length > 0 && <span>🏷️ {r.tags.join(', ')}</span>}
              </div>
              <div className="rl-card-actions">
                {onInsert && (
                  <button className="rl-insert-btn" onClick={() => handleInsert(r)}>
                    📥 {isHt ? 'Itilize' : 'Use'}
                  </button>
                )}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="rl-link-btn">
                    🔗
                  </a>
                )}
                <button className="rl-delete-btn" onClick={() => handleDelete(r.id)}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
