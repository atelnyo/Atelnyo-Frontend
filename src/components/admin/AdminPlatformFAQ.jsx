/**
 * Admin Platform FAQ Manager — CRUD for platform-wide FAQ entries.
 *
 * Mounted as /sheet/admin/platform-faq.  Staff-only.
 *
 * Features:
 *   • List / create / edit / delete FAQ entries
 *   • Manage categories (create, delete)
 *   • Reorder via arrow buttons
 *   • Toggle published / featured
 *   • Search + filter
 */
import React, { useState, useCallback, useEffect } from 'react';
import api from '../../services/api';

const apiFaq = {
  list: (params) => api.get('/platform-faqs/', { params }),
  create: (data) => api.post('/platform-faqs/', data),
  update: (id, data) => api.patch(`/platform-faqs/${id}/`, data),
  remove: (id) => api.delete(`/platform-faqs/${id}/`),
  duplicate: (id) => api.post(`/platform-faqs/${id}/duplicate/`),
  reorder: (ids) => api.post('/platform-faqs/reorder/', { ordered_ids: ids }),
};
const apiCat = {
  list: () => api.get('/platform-faq-categories/'),
  create: (data) => api.post('/platform-faq-categories/', data),
  remove: (id) => api.delete(`/platform-faq-categories/${id}/`),
};

const EMPTY_FORM = { question: '', answer: '', category: '', is_featured: false };

export default function AdminPlatformFAQ({ lang = 'ht', showToast, onNavigate }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  // ─── Load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [faqRes, catRes] = await Promise.all([
        apiFaq.list(),
        apiCat.list(),
      ]);
      setFaqs(faqRes?.data?.results || faqRes?.data || []);
      setCategories(catRes?.data?.results || catRes?.data || []);
    } catch (e) {
      showToast?.(t('Could not load FAQ.', 'Pa t kapab chaje FAQ.'), 'exclamation-circle');
    } finally {
      setLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => { load(); }, [load]);

  // ─── Filtered ──────────────────────────────────────────────────
  const filtered = faqs.filter((f) => {
    if (search && !f.question.toLowerCase().includes(search.toLowerCase())
        && !f.answer.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && String(f.category) !== filterCat) return false;
    return true;
  });

  // ─── CRUD ──────────────────────────────────────────────────────
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); };
  const openEdit = (faq) => {
    setForm({ question: faq.question, answer: faq.answer, category: faq.category || '', is_featured: faq.is_featured });
    setEditingId(faq.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      showToast?.(t('Question and answer required.', 'Kesyon ak repons obligatwa.'), 'exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category || null,
        is_featured: form.is_featured,
      };
      if (editingId) {
        await apiFaq.update(editingId, payload);
        showToast?.(t('FAQ updated.', 'FAQ ajou.'), 'check-circle');
      } else {
        await apiFaq.create(payload);
        showToast?.(t('FAQ created.', 'FAQ kreye.'), 'check-circle');
      }
      setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Save failed.', 'Sove echwe.'), 'exclamation-circle');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('Delete this FAQ?', 'Efase FAQ sa a?'))) return;
    try { await apiFaq.remove(id); showToast?.(t('Deleted.', 'Efase.'), 'check-circle'); await load(); }
    catch { showToast?.(t('Delete failed.', 'Efase echwe.'), 'exclamation-circle'); }
  };

  const handleDuplicate = async (id) => {
    try { await apiFaq.duplicate(id); showToast?.(t('Duplicated.', 'Dupliye.'), 'check-circle'); await load(); }
    catch { showToast?.(t('Duplicate failed.', 'Dupliye echwe.'), 'exclamation-circle'); }
  };

  const handleToggle = async (faq, field) => {
    try { await apiFaq.update(faq.id, { [field]: !faq[field] }); await load(); }
    catch { showToast?.(t('Update failed.', 'Ajou echwe.'), 'exclamation-circle'); }
  };

  const handleMove = async (id, dir) => {
    const idx = faqs.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= faqs.length) return;
    const ids = faqs.map((f) => f.id);
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    try { await apiFaq.reorder(ids); setFaqs((p) => { const n = [...p]; [n[idx], n[swap]] = [n[swap], n[idx]]; return n; }); }
    catch { await load(); }
  };

  // ─── Categories ────────────────────────────────────────────────
  const handleCreateCat = async () => {
    if (!newCatName.trim()) return;
    try {
      await apiCat.create({ name: newCatName.trim(), sort_order: categories.length });
      setNewCatName(''); setShowNewCat(false); await load();
      showToast?.(t('Category created.', 'Kategori kreye.'), 'check-circle');
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Category failed.', 'Kategori echwe.'), 'exclamation-circle');
    }
  };
  const handleDeleteCat = async (id) => {
    if (!window.confirm(t('Delete category?', 'Efase kategori?'))) return;
    try { await apiCat.remove(id); await load(); showToast?.(t('Deleted.', 'Efase.'), 'check-circle'); }
    catch { showToast?.(t('Delete failed.', 'Efase echwe.'), 'exclamation-circle'); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><i className="fas fa-spinner fa-spin" /> {t('Loading...', 'Chaje...')}</div>;

  return (
    <div className="ad-dash-shell">
      {/* Header */}
      <div className="ad-dash-header">
        <div className="ad-dash-header-left">
          <button type="button" className="ad-dash-back" onClick={() => onNavigate?.(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-dash-title">
              <i className="fas fa-question-circle" /> {t('Platform FAQ', 'FAQ Platfòm')}
            </h1>
            <p className="ad-dash-subtitle">
              {t('Manage the public FAQ page.', 'Jere paj FAQ piblik la.')}
            </p>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <button type="button" className="ad-dash-refresh" onClick={() => onNavigate?.('/sheet/admin/dashboard')} title="Dashboard">
            <i className="fas fa-gauge-high" />
          </button>
        </div>
      </div>

      <div className="ad-dash-body">
        {/* Search + Filters */}
        <div className="ad-dash-panel" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <i className="fas fa-search" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search FAQ...', 'Chèche FAQ...')}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1 }} />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <option value="">{t('All categories', 'Tout kategori')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="ad-dash-btn ad-dash-btn--primary" onClick={openCreate} style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              <i className="fas fa-plus" /> {t('Add FAQ', 'Ajoute FAQ')}
            </button>
          </div>
        </div>

        {/* Categories bar */}
        <div className="ad-dash-panel" style={{ marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}><i className="fas fa-tags" /> {t('Categories', 'Kategori')}:</span>
            {categories.map((c) => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-highlight, rgba(0,0,0,0.04))', fontSize: '0.78rem' }}>
                <i className={`fas ${c.icon || 'fa-tag'}`} style={{ fontSize: '0.7rem' }} /> {c.name}
                <button type="button" onClick={() => handleDeleteCat(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.7rem' }} title={t('Delete', 'Efase')}><i className="fas fa-times" /></button>
              </span>
            ))}
            {showNewCat ? (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCat(); if (e.key === 'Escape') setShowNewCat(false); }}
                  placeholder={t('Name', 'Non')} autoFocus
                  style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 6px', fontSize: '0.8rem', width: 120 }} />
                <button type="button" onClick={handleCreateCat} style={{ background: 'var(--color-success, #10b981)', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}><i className="fas fa-check" /></button>
                <button type="button" onClick={() => { setShowNewCat(false); setNewCatName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><i className="fas fa-times" /></button>
              </span>
            ) : (
              <button type="button" onClick={() => setShowNewCat(true)} style={{ background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <i className="fas fa-plus" /> {t('Add', 'Ajoute')}
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="ad-dash-panel" style={{ marginBottom: 16, borderLeft: '3px solid var(--color-primary, #d81b60)' }}>
            <div style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
                <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus-circle'}`} /> {editingId ? t('Edit FAQ', 'Modifye FAQ') : t('New FAQ', 'Nouvo FAQ')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
                  placeholder={t('Question...', 'Kesyon...')} maxLength={500}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }} />
                <textarea value={form.answer} onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                  placeholder={t('Answer...', 'Repons...')} rows={4}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: '0.9rem', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                    <option value="">{t('No category', 'Pa gen kategori')}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((p) => ({ ...p, is_featured: e.target.checked }))} />
                    <i className="fas fa-star" style={{ color: '#f59e0b' }} /> {t('Featured', 'Rekòmande')}
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleSave} disabled={saving}
                    style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary, #d81b60)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />} {editingId ? t('Update', 'Ajou') : t('Create', 'Kreye')}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
                    style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {t('Cancel', 'Anile')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ list */}
        {filtered.length === 0 ? (
          <div className="ad-dash-panel-empty">
            <i className="fas fa-question-circle" />
            <p>{t('No FAQ yet. Click "Add FAQ" to start.', 'Pa gen FAQ ankò. Klike "Ajoute FAQ" pou kòmanse.')}</p>
          </div>
        ) : filtered.map((faq, idx) => {
          const isOpen = expandedId === faq.id;
          const cat = categories.find((c) => c.id === faq.category);
          return (
            <div key={faq.id} className="ad-dash-panel" style={{ marginBottom: 8, borderLeft: faq.is_featured ? '3px solid #f59e0b' : faq.is_published ? undefined : '3px solid var(--text-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button type="button" onClick={() => handleMove(faq.id, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.7rem', padding: 0 }}><i className="fas fa-chevron-up" /></button>
                  <button type="button" onClick={() => handleMove(faq.id, 'down')} disabled={idx === filtered.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.7rem', padding: 0 }}><i className="fas fa-chevron-down" /></button>
                </div>
                <button type="button" onClick={() => setExpandedId(isOpen ? null : faq.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1 }}>{faq.question}</span>
                  <i className={`fas fa-chevron-down ${isOpen ? 'fa-rotate-180' : ''}`} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }} />
                </button>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  {cat && <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 99, background: 'var(--bg-highlight, rgba(0,0,0,0.04))' }}>{cat.name}</span>}
                  {faq.is_featured && <i className="fas fa-star" style={{ fontSize: '0.7rem', color: '#f59e0b' }} />}
                  <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 99, background: faq.is_published ? 'rgba(16,185,129,0.1)' : 'rgba(100,100,100,0.1)', color: faq.is_published ? '#10b981' : 'var(--text-tertiary)' }}>
                    {faq.is_published ? t('Live', 'Vivan') : t('Draft', 'Brouyon')}
                  </span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <p style={{ margin: '10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{faq.answer}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openEdit(faq)} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer' }}><i className="fas fa-edit" /> {t('Edit', 'Modifye')}</button>
                    <button type="button" onClick={() => handleDuplicate(faq.id)} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer' }}><i className="fas fa-copy" /> {t('Copy', 'Kopye')}</button>
                    <button type="button" onClick={() => handleToggle(faq, 'is_featured')} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer' }}><i className="fas fa-star" /> {faq.is_featured ? t('Unfeature', 'Chanje') : t('Feature', 'Rekòmande')}</button>
                    <button type="button" onClick={() => handleToggle(faq, 'is_published')} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer' }}><i className={`fas ${faq.is_published ? 'fa-eye-slash' : 'fa-eye'}`} /> {faq.is_published ? t('Hide', 'Kache') : t('Publish', 'Pibliye')}</button>
                    <button type="button" onClick={() => handleDelete(faq.id)} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash" /> {t('Delete', 'Efase')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
