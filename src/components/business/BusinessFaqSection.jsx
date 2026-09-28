/**
 * src/components/business/BusinessFaqSection.jsx
 *
 * Phase 7a — Business-level FAQ management inside the Business
 * Workspace (the "FAQs" tab).
 *
 * Business FAQ = questions about the BUSINESS itself (location,
 * hours, payment methods, delivery, returns...). This is clearly
 * separated from Product FAQ (per catalog item), which is managed
 * from the Catalog tab.
 *
 * Data flow
 * ---------
 *   GET    /api/business/faqs/?profile=<slug>  — my FAQs (owner)
 *   POST   /api/business/faqs/                 — add
 *   PATCH  /api/business/faqs/<id>/            — edit (incl. reorder/status)
 *   DELETE /api/business/faqs/<id>/            — delete
 */
import React, { useEffect, useState } from 'react';
import { businessFaqService } from '../../services/api';

const STATUS_LABELS = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

export default function BusinessFaqSection({ lang = 'ht', t, showToast, profile }) {
  const isHt = lang === 'ht';
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '', status: 'active' });

  useEffect(() => {
    if (!profile?.slug) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await businessFaqService.list(profile.slug);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setFaqs(data);
      } catch {
        if (!cancelled) {
          showToast?.(
            isHt ? 'Pa t kapab chaje FAQ yo.' : 'Could not load the FAQs.',
            'circle-exclamation',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.slug]);

  const openCreate = () => {
    setEditing(null);
    setForm({ question: '', answer: '', status: 'active' });
    setFormOpen(true);
  };

  const openEdit = (faq) => {
    setEditing(faq);
    setForm({
      question: faq.question || '',
      answer: faq.answer || '',
      status: faq.status || 'active',
    });
    setFormOpen(true);
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((form.question || '').trim().length < 3) {
      showToast?.(
        isHt ? 'Kesyon an twò kout (3 karaktè minimòm).' : 'Question is too short (3+ characters).',
        'circle-exclamation',
      );
      return;
    }
    if (!(form.answer || '').trim()) {
      showToast?.(
        isHt ? 'Repons lan obligatwa.' : 'Answer is required.',
        'circle-exclamation',
      );
      return;
    }
    setSaving(true);
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      status: form.status,
    };
    try {
      if (editing) {
        const res = await businessFaqService.update(editing.id, payload);
        const updated = res?.data?.data ?? res?.data ?? null;
        if (updated?.id) {
          setFaqs((prev) => prev.map((f) => (f.id === updated.id ? updated : f)).sort((a, b) => a.sort_order - b.sort_order));
        }
        showToast?.(isHt ? '✅ FAQ mete ajou!' : '✅ FAQ updated!', 'check-circle');
      } else {
        const res = await businessFaqService.create({
          ...payload,
          business_profile: profile.id,
          sort_order: faqs.length,
        });
        const created = res?.data?.data ?? res?.data ?? null;
        if (created?.id) setFaqs((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
        showToast?.(isHt ? '✅ FAQ ajoute!' : '✅ FAQ added!', 'check-circle');
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.question?.[0]
        || err?.response?.data?.answer?.[0]
        || err?.response?.data?.business_profile?.[0]
        || (isHt ? 'Pa t kapab sove FAQ la.' : 'Could not save the FAQ.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= faqs.length) return;
    const a = faqs[index];
    const b = faqs[target];
    setBusyId(a.id);
    try {
      // Swap sort_orders server-side (a clean two-PATCH reorder).
      await businessFaqService.update(a.id, { sort_order: b.sort_order });
      const resB = await businessFaqService.update(b.id, { sort_order: a.sort_order });
      const updatedB = resB?.data?.data ?? resB?.data ?? null;
      setFaqs((prev) => prev
        .map((f) => (f.id === a.id ? { ...f, sort_order: b.sort_order } : f))
        .map((f) => (updatedB?.id && f.id === b.id ? updatedB : f))
        .sort((x, y) => x.sort_order - y.sort_order));
    } catch {
      showToast?.(
        isHt ? 'Pa t kapab reyòdone FAQ yo.' : 'Could not reorder FAQs.',
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (faq) => {
    const next = faq.status === 'active' ? 'archived' : 'active';
    setBusyId(faq.id);
    try {
      const res = await businessFaqService.update(faq.id, { status: next });
      const updated = res?.data?.data ?? res?.data ?? null;
      if (updated?.id) setFaqs((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      showToast?.(
        next === 'active'
          ? (isHt ? 'FAQ la aktif ankò.' : 'FAQ is active again.')
          : (isHt ? 'FAQ la achive.' : 'FAQ archived.'),
        next === 'active' ? 'circle-play' : 'box-archive',
      );
    } catch {
      showToast?.(
        isHt ? 'Aksyon an pa t mache.' : 'The action failed.',
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (faq) => {
    setBusyId(faq.id);
    try {
      await businessFaqService.remove(faq.id);
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
      showToast?.(isHt ? 'FAQ la efase.' : 'FAQ deleted.', 'trash');
    } catch {
      showToast?.(
        isHt ? 'Pa t kapab efase FAQ la.' : 'Could not delete the FAQ.',
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="biz-faqs" data-testid="business-faqs">
      <div className="biz-catalog-header">
        <div>
          <h3 className="biz-catalog-title">
            <i className="fas fa-circle-question" aria-hidden="true" />
            {t?.business_section_faqs || (isHt ? 'FAQ Biznis' : 'Business FAQs')}
          </h3>
          <p className="biz-catalog-hint">
            {t?.business_faqs_hint || (isHt
              ? 'Kesyon sou biznis la an jeneral (kote ou ye, èdtan, peman...). Kesyon sou yon atik espesifik ale nan katalòg la.'
              : 'Questions about the business itself (location, hours, payments...). Item-specific questions live in the Catalog.')}
          </p>
        </div>
        <button
          type="button"
          className="biz-btn biz-btn-primary"
          onClick={openCreate}
          data-testid="business-faq-add"
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {t?.business_faq_add || (isHt ? 'Ajoute yon FAQ' : 'Add a FAQ')}
        </button>
      </div>

      {loading ? (
        <div className="biz-catalog-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="biz-catalog-empty" data-testid="business-faq-empty">
          <i className="fas fa-circle-question" aria-hidden="true" />
          <h4>{t?.business_faq_empty || (isHt ? 'Pokò gen FAQ' : 'No FAQs yet')}</h4>
          <p>
            {t?.business_faq_empty_hint || (isHt
              ? 'Ajoute kesyon moun yo poze souvan. FAQ aktif yo ap parèt sou paj piblik biznis ou.'
              : 'Add the questions customers ask most. Active FAQs appear on your public business page.')}
          </p>
        </div>
      ) : (
        <div className="biz-faq-list" style={{ maxWidth: 720, margin: '0 auto' }}>
          {faqs.map((faq, index) => {
            const color = faq.status === 'active' ? '#34d399' : (faq.status === 'draft' ? '#fbbf24' : '#94a3b8');
            return (
              <article className="biz-ws-card biz-faq-row" key={faq.id} data-testid="business-faq-item">
                <div className="biz-faq-row-main">
                  <div className="biz-faq-row-head">
                    <span className="biz-faq-q">“{faq.question}”</span>
                    <span
                      className="biz-status-pill"
                      style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
                    >
                      {t?.[`business_catalog_status_${faq.status}`] || STATUS_LABELS[faq.status] || faq.status}
                    </span>
                  </div>
                  <p className="biz-faq-a">{faq.answer}</p>
                </div>
                <div className="biz-faq-row-actions">
                  <button
                    type="button"
                    className="biz-btn biz-btn-ghost biz-btn-sm"
                    onClick={() => move(index, -1)}
                    disabled={busyId === faq.id || index === 0}
                    aria-label={isHt ? 'Moute' : 'Move up'}
                    data-testid="business-faq-up"
                  >
                    <i className="fas fa-arrow-up" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="biz-btn biz-btn-ghost biz-btn-sm"
                    onClick={() => move(index, 1)}
                    disabled={busyId === faq.id || index === faqs.length - 1}
                    aria-label={isHt ? 'Desann' : 'Move down'}
                    data-testid="business-faq-down"
                  >
                    <i className="fas fa-arrow-down" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="biz-btn biz-btn-ghost biz-btn-sm"
                    onClick={() => toggleStatus(faq)}
                    disabled={busyId === faq.id}
                    title={faq.status === 'active' ? (isHt ? 'Achive' : 'Archive') : (isHt ? 'Aktive' : 'Activate')}
                  >
                    <i className={`fas ${faq.status === 'active' ? 'fa-box-archive' : 'fa-circle-play'}`} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="biz-btn biz-btn-ghost biz-btn-sm"
                    onClick={() => openEdit(faq)}
                    disabled={busyId === faq.id}
                    data-testid="business-faq-edit"
                  >
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="biz-btn biz-btn-danger biz-btn-sm"
                    onClick={() => { if (window.confirm(isHt ? 'Efase FAQ sa a?' : 'Delete this FAQ?')) handleDelete(faq); }}
                    disabled={busyId === faq.id}
                    data-testid="business-faq-delete"
                  >
                    <i className="fas fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="biz-modal-overlay" onClick={() => { if (!saving) setFormOpen(false); }} role="presentation">
          <div
            className="biz-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? (isHt ? 'Modifye FAQ la' : 'Edit FAQ') : (isHt ? 'Ajoute yon FAQ' : 'Add a FAQ')}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-circle-question" aria-hidden="true" />
                {editing
                  ? (t?.business_faq_edit || (isHt ? 'Modifye FAQ la' : 'Edit FAQ'))
                  : (t?.business_faq_add || (isHt ? 'Ajoute yon FAQ' : 'Add a FAQ'))}
              </h3>
              <button type="button" className="biz-modal-close" onClick={() => { if (!saving) setFormOpen(false); }} aria-label={isHt ? 'Fèmen' : 'Close'}>
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="biz-form" data-testid="business-faq-form">
              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_faq_question || (isHt ? 'Kesyon' : 'Question')} *
                </label>
                <input
                  type="text"
                  className="biz-form-input"
                  value={form.question}
                  onChange={(e) => set('question', e.target.value)}
                  maxLength={300}
                  placeholder={isHt ? 'Egzanp: Ki èdtan ouvèti yo?' : 'e.g. What are your opening hours?'}
                  data-testid="business-faq-question"
                  required
                  autoFocus
                />
              </div>
              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_faq_answer || (isHt ? 'Repons' : 'Answer')} *
                </label>
                <textarea
                  className="biz-form-input"
                  rows={3}
                  value={form.answer}
                  onChange={(e) => set('answer', e.target.value)}
                  maxLength={2000}
                  placeholder={isHt ? 'Repons klè ak kout...' : 'A clear, short answer...'}
                  data-testid="business-faq-answer"
                />
              </div>
              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_catalog_field_status || (isHt ? 'Estati' : 'Status')}
                </label>
                <select
                  className="biz-form-input"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">{isHt ? 'Aktif (parèt sou paj piblik)' : 'Active (shows on public page)'}</option>
                  <option value="draft">{isHt ? 'Brouyon' : 'Draft'}</option>
                  <option value="archived">{isHt ? 'Achive' : 'Archived'}</option>
                </select>
              </div>
              <div className="biz-form-actions">
                <button type="button" className="biz-btn biz-btn-ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                  {isHt ? 'Anile' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="biz-btn biz-btn-primary"
                  disabled={saving}
                  data-testid="business-faq-submit"
                >
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
                  {saving
                    ? (isHt ? 'Ap sove...' : 'Saving...')
                    : (editing ? (isHt ? 'Sove chanjman' : 'Save changes') : (isHt ? 'Ajoute FAQ' : 'Add FAQ'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
