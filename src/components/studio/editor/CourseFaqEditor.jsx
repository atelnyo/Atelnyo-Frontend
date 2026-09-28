/**
 * src/components/studio/editor/CourseFaqEditor.jsx
 *
 * Creator-side FAQ manager for a course — REAL backend
 * (CourseFAQ / CourseFAQCategory models + /api/course-faqs/).
 *
 * The creator creates, edits, organizes, reorders, and controls
 * visibility of FAQ entries for their course.  FAQ is part of the
 * course's learner-support experience (spec §1–§27).
 *
 * Features:
 *   • CRUD FAQ entries (question, answer, category, scope, visibility)
 *   • Custom categories (create, rename, reorder)
 *   • Bulk reorder via drag handles / arrow buttons
 *   • Duplicate FAQ entries
 *   • Preview as learner
 *   • Search and filter
 */
import React, { useState, useCallback, useRef } from 'react';
import { courseFaqService } from '../../../services/api';
import styles from './editor.module.css';

const SCOPE_OPTIONS = [
  { value: 'course', labelEn: 'Course', labelHt: 'Kou' },
  { value: 'module', labelEn: 'Module', labelHt: 'Modil' },
  { value: 'lesson', labelEn: 'Lesson', labelHt: 'Leçon' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', labelEn: 'Private/Internal', labelHt: 'Privé/Entèn' },
  { value: 'enrolled', labelEn: 'Learners Only', labelHt: 'Elèv sèlman' },
  { value: 'public', labelEn: 'Public', labelHt: 'Piblik' },
];

const VISIBILITY_ICONS = {
  private: 'fa-lock',
  enrolled: 'fa-user-graduate',
  public: 'fa-globe',
};

const EMPTY_FORM = {
  question: '',
  answer: '',
  category: '',
  scope: 'course',
  module_index: '',
  block_id: '',
  visibility: 'enrolled',
  is_featured: false,
};

export default function CourseFaqEditor({ courseId, modules = [], lang = 'ht', showToast }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const formRef = useRef(null);

  // ─── Load FAQ + categories ─────────────────────────────────────────
  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const [faqRes, catRes] = await Promise.all([
        courseFaqService.list(courseId),
        courseFaqService.categories(courseId),
      ]);
      const faqList = Array.isArray(faqRes?.data?.results) ? faqRes.data.results
        : (Array.isArray(faqRes?.data) ? faqRes.data : []);
      const catList = Array.isArray(catRes?.data?.results) ? catRes.data.results
        : (Array.isArray(catRes?.data) ? catRes.data : []);
      setFaqs(faqList);
      setCategories(catList);
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not load FAQ.', 'Pa t kapab chaje FAQ.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, lang]);

  React.useEffect(() => { load(); }, [load]);

  // ─── Filtered FAQ list ─────────────────────────────────────────────
  const filtered = faqs.filter((f) => {
    if (search && !f.question.toLowerCase().includes(search.toLowerCase())
        && !f.answer.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && String(f.category) !== filterCategory) return false;
    if (filterVisibility && f.visibility !== filterVisibility) return false;
    return true;
  });

  // ─── Create / Update FAQ ───────────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const openEdit = (faq) => {
    setForm({
      question: faq.question || '',
      answer: faq.answer || '',
      category: faq.category || '',
      scope: faq.scope || 'course',
      module_index: faq.module_index ?? '',
      block_id: faq.block_id || '',
      visibility: faq.visibility || 'enrolled',
      is_featured: Boolean(faq.is_featured),
    });
    setEditingId(faq.id);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSave = async () => {
    if (!form.question.trim()) {
      showToast?.(t('Question is required.', 'Obligatwa antre yon kesyon.'), 'exclamation-circle');
      return;
    }
    if (!form.answer.trim()) {
      showToast?.(t('Answer is required.', 'Obligatwa antre yon repons.'), 'exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        course: courseId,
        question: form.question.trim(),
        answer: form.answer.trim(),
        scope: form.scope,
        visibility: form.visibility,
        is_featured: form.is_featured,
        category: form.category || null,
        module_index: form.module_index !== '' ? Number(form.module_index) : null,
        block_id: form.block_id || '',
      };
      if (editingId) {
        await courseFaqService.update(editingId, payload);
        showToast?.(t('FAQ updated.', 'FAQ ajou.'), 'check-circle');
      } else {
        await courseFaqService.create(payload);
        showToast?.(t('FAQ created.', 'FAQ kreye.'), 'check-circle');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message
        || t('Could not save FAQ.', 'Pa t kapab sove FAQ.');
      showToast?.(detail, 'exclamation-circle');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete FAQ ────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm(t('Delete this FAQ?', 'Efase FAQ sa a?'))) return;
    try {
      await courseFaqService.remove(id);
      showToast?.(t('FAQ deleted.', 'FAQ efase.'), 'check-circle');
      await load();
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Could not delete.', 'Pa t kapab efase.'), 'exclamation-circle');
    }
  };

  // ─── Duplicate FAQ ─────────────────────────────────────────────────
  const handleDuplicate = async (id) => {
    try {
      await courseFaqService.duplicate(id);
      showToast?.(t('FAQ duplicated.', 'FAQ dupliye.'), 'check-circle');
      await load();
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Could not duplicate.', 'Pa t kapab dupliye.'), 'exclamation-circle');
    }
  };

  // ─── Move FAQ up/down ──────────────────────────────────────────────
  const handleMove = async (id, direction) => {
    const idx = faqs.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= faqs.length) return;
    const newOrder = faqs.map((f) => f.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    try {
      await courseFaqService.reorder(newOrder);
      // Optimistically reorder
      setFaqs((prev) => {
        const next = [...prev];
        [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
        return next;
      });
    } catch {
      // Revert on failure
      await load();
    }
  };

  // ─── Toggle published ──────────────────────────────────────────────
  const handleTogglePublished = async (faq) => {
    try {
      await courseFaqService.update(faq.id, { is_published: !faq.is_published });
      await load();
    } catch (e) {
      showToast?.(t('Could not update.', 'Pa t kapab ajou.'), 'exclamation-circle');
    }
  };

  // ─── Toggle featured ───────────────────────────────────────────────
  const handleToggleFeatured = async (faq) => {
    try {
      await courseFaqService.update(faq.id, { is_featured: !faq.is_featured });
      await load();
    } catch (e) {
      showToast?.(t('Could not update.', 'Pa t kapab ajou.'), 'exclamation-circle');
    }
  };

  // ─── Create custom category ────────────────────────────────────────
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await courseFaqService.createCategory({
        course: courseId,
        name: newCatName.trim(),
        sort_order: categories.length,
      });
      setNewCatName('');
      setShowNewCat(false);
      const catRes = await courseFaqService.categories(courseId);
      const catList = Array.isArray(catRes?.data?.results) ? catRes.data.results
        : (Array.isArray(catRes?.data) ? catRes.data : []);
      setCategories(catList);
      showToast?.(t('Category created.', 'Kategori kreye.'), 'check-circle');
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Could not create category.', 'Pa t kapab kreye kategori.'), 'exclamation-circle');
    }
  };

  // ─── Delete category ───────────────────────────────────────────────
  const handleDeleteCategory = async (catId) => {
    if (!window.confirm(t('Delete this category?', 'Efase kategori sa a?'))) return;
    try {
      await courseFaqService.deleteCategory(catId);
      await load();
      showToast?.(t('Category deleted.', 'Kategori efase.'), 'check-circle');
    } catch (e) {
      showToast?.(e?.response?.data?.detail || t('Could not delete category.', 'Pa t kapab efase kategori.'), 'exclamation-circle');
    }
  };

  if (loading) {
    return (
      <div className={styles.faqLoading}>
        <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading FAQ...', 'Chaje FAQ...')}
      </div>
    );
  }

  return (
    <div className={styles.faqEditor} data-testid="course-faq-editor">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className={styles.faqHeader}>
        <h3 className={styles.faqTitle}>
          <i className="fas fa-question-circle" aria-hidden="true" />
          {' '}{t('Course FAQ', 'FAQ Kou')}
          <span className={styles.faqCount}>{faqs.length}</span>
        </h3>
        <button type="button" className={styles.faqAddBtn} onClick={openCreate}>
          <i className="fas fa-plus" aria-hidden="true" />
          {' '}{t('Add FAQ', 'Ajoute FAQ')}
        </button>
      </div>

      {error && (
        <div className={styles.faqError}>
          <i className="fas fa-exclamation-triangle" aria-hidden="true" /> {error}
        </div>
      )}

      {/* ─── Search + Filters ────────────────────────────── */}
      <div className={styles.faqFilters}>
        <div className={styles.faqSearchWrap}>
          <i className="fas fa-search" aria-hidden="true" />
          <input
            type="text"
            className={styles.faqSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search FAQ...', 'Chèche FAQ...')}
            aria-label={t('Search FAQ', 'Chèche FAQ')}
          />
        </div>
        <select
          className={styles.faqFilterSelect}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label={t('Filter by category', 'Filtre pa kategori')}
        >
          <option value="">{t('All categories', 'Tout kategori')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          className={styles.faqFilterSelect}
          value={filterVisibility}
          onChange={(e) => setFilterVisibility(e.target.value)}
          aria-label={t('Filter by visibility', 'Filtre pa vizibilite')}
        >
          <option value="">{t('All visibility', 'Tout vizibilite')}</option>
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{isHt ? opt.labelHt : opt.labelEn}</option>
          ))}
        </select>
      </div>

      {/* ─── Categories management ───────────────────────── */}
      <div className={styles.faqCategoriesBar}>
        <span className={styles.faqCategoriesLabel}>
          <i className="fas fa-tags" aria-hidden="true" /> {t('Categories', 'Kategori')}:
        </span>
        <div className={styles.faqCategoryChips}>
          {categories.map((cat) => (
            <span key={cat.id} className={styles.faqCategoryChip}>
              {cat.name}
              {cat.faq_count > 0 && <span className={styles.faqCatCount}>{cat.faq_count}</span>}
              {!cat.is_default && (
                <button
                  type="button"
                  className={styles.faqCatDelete}
                  onClick={() => handleDeleteCategory(cat.id)}
                  aria-label={t('Delete category', 'Efase kategori')}
                  title={t('Delete', 'Efase')}
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          {showNewCat ? (
            <span className={styles.faqNewCatWrap}>
              <input
                type="text"
                className={styles.faqNewCatInput}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowNewCat(false); }}
                placeholder={t('Category name', 'Non kategori')}
                autoFocus
              />
              <button type="button" className={styles.faqNewCatSave} onClick={handleCreateCategory}>
                <i className="fas fa-check" aria-hidden="true" />
              </button>
              <button type="button" className={styles.faqNewCatCancel} onClick={() => { setShowNewCat(false); setNewCatName(''); }}>
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button type="button" className={styles.faqAddCatBtn} onClick={() => setShowNewCat(true)}>
              <i className="fas fa-plus" aria-hidden="true" /> {t('Add', 'Ajoute')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Create / Edit Form ──────────────────────────── */}
      {showForm && (
        <div className={styles.faqForm} ref={formRef} data-testid="faq-form">
          <h4 className={styles.faqFormTitle}>
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus-circle'}`} aria-hidden="true" />
            {' '}{editingId ? t('Edit FAQ', 'Modifye FAQ') : t('New FAQ', 'Nouvo FAQ')}
          </h4>

          <div className={styles.faqFormGroup}>
            <label className={styles.faqLabel}>{t('Question', 'Kesyon')} *</label>
            <input
              type="text"
              className={styles.faqInput}
              value={form.question}
              onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
              placeholder={t('e.g. Is this course suitable for beginners?', 'eg. Èske kou sa a bon pou debutan?')}
              maxLength={500}
              autoFocus
            />
          </div>

          <div className={styles.faqFormGroup}>
            <label className={styles.faqLabel}>{t('Answer', 'Repons')} *</label>
            <textarea
              className={styles.faqTextarea}
              value={form.answer}
              onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
              placeholder={t('Write a clear, helpful answer...', 'Ekri yon repons klè, itil...')}
              rows={4}
            />
          </div>

          <div className={styles.faqFormRow}>
            <div className={styles.faqFormGroup}>
              <label className={styles.faqLabel}>{t('Category', 'Kategori')}</label>
              <select
                className={styles.faqSelect}
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                <option value="">{t('— None —', '— Pa gen —')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.faqFormGroup}>
              <label className={styles.faqLabel}>{t('Scope', 'Kote')}</label>
              <select
                className={styles.faqSelect}
                value={form.scope}
                onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{isHt ? opt.labelHt : opt.labelEn}</option>
                ))}
              </select>
            </div>

            <div className={styles.faqFormGroup}>
              <label className={styles.faqLabel}>{t('Visibility', 'Vizibilite')}</label>
              <select
                className={styles.faqSelect}
                value={form.visibility}
                onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{isHt ? opt.labelHt : opt.labelEn}</option>
                ))}
              </select>
            </div>
          </div>

          {(form.scope === 'module' || form.scope === 'lesson') && (
            <div className={styles.faqFormRow}>
              <div className={styles.faqFormGroup}>
                <label className={styles.faqLabel}>{t('Module', 'Modil')}</label>
                <select
                  className={styles.faqSelect}
                  value={form.module_index}
                  onChange={(e) => setForm((p) => ({ ...p, module_index: e.target.value }))}
                >
                  <option value="">{t('— Select —', '— Chwazi —')}</option>
                  {(modules || []).map((m, i) => (
                    <option key={i} value={i}>{m.title || `${t('Module', 'Modil')} ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              {form.scope === 'lesson' && (
                <div className={styles.faqFormGroup}>
                  <label className={styles.faqLabel}>{t('Block ID', 'ID Bloke')}</label>
                  <input
                    type="text"
                    className={styles.faqInput}
                    value={form.block_id}
                    onChange={(e) => setForm((p) => ({ ...p, block_id: e.target.value }))}
                    placeholder="block-1a"
                  />
                </div>
              )}
            </div>
          )}

          <div className={styles.faqFormRow}>
            <label className={styles.faqCheckbox}>
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((p) => ({ ...p, is_featured: e.target.checked }))}
              />
              <i className="fas fa-star" aria-hidden="true" /> {t('Featured', 'Rekòmande')}
            </label>
          </div>

          <div className={styles.faqFormActions}>
            <button type="button" className={styles.faqSaveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                : <i className="fas fa-check" aria-hidden="true" />}
              {' '}{editingId ? t('Update', 'Ajou') : t('Create', 'Kreye')}
            </button>
            <button
              type="button"
              className={styles.faqCancelBtn}
              onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
            >
              {t('Cancel', 'Anile')}
            </button>
          </div>
        </div>
      )}

      {/* ─── FAQ List ────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className={styles.faqEmpty}>
          <i className="fas fa-question-circle" aria-hidden="true" />
          <p>{faqs.length === 0
            ? t('No FAQ yet. Click "Add FAQ" to create your first question.', 'Pa gen FAQ ankò. Klike "Ajoute FAQ" pou kreye premye kesyon ou.')
            : t('No FAQ matches your filters.', 'Pa gen FAQ ki mache ak filtre ou.')}
          </p>
        </div>
      ) : (
        <div className={styles.faqList}>
          {filtered.map((faq, idx) => {
            const isOpen = expandedId === faq.id;
            const cat = categories.find((c) => c.id === faq.category);
            return (
              <div
                key={faq.id}
                className={`${styles.faqItem} ${!faq.is_published ? styles.faqItemUnpublished : ''} ${faq.is_featured ? styles.faqItemFeatured : ''}`}
              >
                <div className={styles.faqItemHeader}>
                  <div className={styles.faqItemReorder}>
                    <button
                      type="button"
                      className={styles.faqReorderBtn}
                      onClick={() => handleMove(faq.id, 'up')}
                      disabled={idx === 0}
                      aria-label={t('Move up', 'Deplase anwo')}
                      title={t('Move up', 'Deplase anwo')}
                    >
                      <i className="fas fa-chevron-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.faqReorderBtn}
                      onClick={() => handleMove(faq.id, 'down')}
                      disabled={idx === filtered.length - 1}
                      aria-label={t('Move down', 'Deplase anba')}
                      title={t('Move down', 'Deplase anba')}
                    >
                      <i className="fas fa-chevron-down" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.faqItemToggle}
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.faqItemQuestion}>{faq.question}</span>
                    <i className={`fas fa-chevron-down ${isOpen ? styles.faqChevronOpen : ''}`} aria-hidden="true" />
                  </button>
                  <div className={styles.faqItemBadges}>
                    {cat && <span className={styles.faqBadge}>{cat.name}</span>}
                    <span className={`${styles.faqBadge} ${styles[`faqBadge_${faq.visibility}`]}`}>
                      <i className={`fas ${VISIBILITY_ICONS[faq.visibility] || 'fa-eye'}`} aria-hidden="true" />
                      {' '}{isHt
                        ? (faq.visibility === 'private' ? 'Privé' : faq.visibility === 'enrolled' ? 'Elèv' : 'Piblik')
                        : faq.visibility}
                    </span>
                    {faq.is_featured && (
                      <span className={`${styles.faqBadge} ${styles.faqBadgeFeatured}`}>
                        <i className="fas fa-star" aria-hidden="true" />
                      </span>
                    )}
                    {!faq.is_published && (
                      <span className={`${styles.faqBadge} ${styles.faqBadgeDraft}`}>
                        {t('Draft', 'Brouyon')}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className={styles.faqItemBody}>
                    <p className={styles.faqItemAnswer}>{faq.answer}</p>
                    <div className={styles.faqItemActions}>
                      <button type="button" className={styles.faqActionBtn} onClick={() => openEdit(faq)}>
                        <i className="fas fa-edit" aria-hidden="true" /> {t('Edit', 'Modifye')}
                      </button>
                      <button type="button" className={styles.faqActionBtn} onClick={() => handleDuplicate(faq.id)}>
                        <i className="fas fa-copy" aria-hidden="true" /> {t('Duplicate', 'Dupliye')}
                      </button>
                      <button type="button" className={styles.faqActionBtn} onClick={() => handleToggleFeatured(faq)}>
                        <i className={`fas fa-star ${faq.is_featured ? styles.faqStarActive : ''}`} aria-hidden="true" />
                        {' '}{faq.is_featured ? t('Unfeature', 'Chanje') : t('Feature', 'Rekòmande')}
                      </button>
                      <button type="button" className={styles.faqActionBtn} onClick={() => handleTogglePublished(faq)}>
                        <i className={`fas ${faq.is_published ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                        {' '}{faq.is_published ? t('Unpublish', 'Kache') : t('Publish', 'Pibliye')}
                      </button>
                      <button type="button" className={`${styles.faqActionBtn} ${styles.faqActionDanger}`} onClick={() => handleDelete(faq.id)}>
                        <i className="fas fa-trash" aria-hidden="true" /> {t('Delete', 'Efase')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
