/**
 * src/components/business/BusinessCatalogSection.jsx
 *
 * Phase 4 — Business Catalog management inside the Business Workspace.
 *
 * The catalog belongs to the Business Profile — NEVER to the Creator
 * Profile. Items are owner-scoped through the owning profile (the
 * backend 404s/empties everything for non-owners), and they are never
 * registered in Explore / Home Feed / Search / marketplace — the ONLY
 * public read is the active-items action on the public business page.
 *
 * Data flow
 * ---------
 *   GET    /api/business/catalog/?profile=<slug>   — my items (owner)
 *   POST   /api/business/catalog/                  — add an item
 *   PATCH  /api/business/catalog/<id>/             — edit (incl. status)
 *   DELETE /api/business/catalog/<id>/             — delete (operational)
 */
import React, { useEffect, useState } from 'react';
import { businessCatalogService, businessProductFaqService } from '../../services/api';

const STATUS_LABELS = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

const STATUS_COLORS = {
  active: '#34d399',
  draft: '#fbbf24',
  archived: '#94a3b8',
};

export default function BusinessCatalogSection({ lang = 'ht', t, showToast, profile }) {
  const isHt = lang === 'ht';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // item being edited
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null); // item with an action in flight
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [form, setForm] = useState({
    name: '', category: '', price: '', currency: 'USD', image_url: '', description: '', status: 'active',
  });
  // Phase 7a — per-item product FAQ editor.
  const [faqItem, setFaqItem] = useState(null);   // item whose FAQs are open
  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqFormOpen, setFaqFormOpen] = useState(false);
  const [faqEditing, setFaqEditing] = useState(null);
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqBusyId, setFaqBusyId] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', status: 'active' });

  // Fetch my items on mount (owner-scoped backend; profile.slug from
  // the workspace's already-loaded profile).
  useEffect(() => {
    if (!profile?.slug) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await businessCatalogService.list(profile.slug);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) {
          showToast?.(
            isHt ? 'Pa t kapab chaje katalòg la.' : 'Could not load the catalog.',
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
    setForm({ name: '', category: '', price: '', currency: 'USD', image_url: '', description: '', status: 'active' });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      category: item.category || '',
      price: item.price != null ? String(item.price) : '',
      currency: item.currency || 'USD',
      image_url: item.image_url || '',
      description: item.description || '',
      status: item.status || 'active',
    });
    setFormOpen(true);
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast?.(
        isHt ? 'Non atik la obligatwa.' : 'Item name is required.',
        'circle-exclamation',
      );
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      image_url: form.image_url.trim(),
      description: form.description.trim(),
      currency: (form.currency || 'USD').toUpperCase().slice(0, 3),
      price: form.price === '' ? 0 : Number(form.price),
    };
    try {
      if (editing) {
        payload.status = form.status;
        const res = await businessCatalogService.update(editing.id, payload);
        const updated = res?.data?.data ?? res?.data ?? null;
        if (updated?.id) {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        }
        showToast?.(
          isHt ? '✅ Atik mete ajou!' : '✅ Item updated!',
          'check-circle',
        );
      } else {
        const res = await businessCatalogService.create({ ...payload, business_profile: profile.id });
        const created = res?.data?.data ?? res?.data ?? null;
        if (created?.id) setItems((prev) => [created, ...prev]);
        showToast?.(
          isHt ? '✅ Atik ajoute nan katalòg la!' : '✅ Item added to the catalog!',
          'check-circle',
        );
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.name?.[0]
        || err?.response?.data?.business_profile?.[0]
        || (isHt ? 'Pa t kapab sove atik la.' : 'Could not save the item.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    const next = item.status === 'active' ? 'archived' : 'active';
    setBusyId(item.id);
    try {
      const res = await businessCatalogService.update(item.id, { status: next });
      const updated = res?.data?.data ?? res?.data ?? null;
      if (updated?.id) {
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      }
      showToast?.(
        next === 'active'
          ? (isHt ? 'Atik la aktif ankò.' : 'Item is active again.')
          : (isHt ? 'Atik la achive.' : 'Item archived.'),
        next === 'active' ? 'circle-play' : 'box-archive',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Aksyon an pa t mache.' : 'The action failed.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    setBusyId(item.id);
    try {
      await businessCatalogService.remove(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setConfirmDeleteId(null);
      showToast?.(
        isHt ? 'Atik la efase.' : 'Item deleted.',
        'trash',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab efase atik la.' : 'Could not delete the item.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const formatPrice = (item) => {
    const value = Number(item.price ?? 0);
    const symbol = item.currency === 'HTG' ? 'G' : (item.currency || 'USD');
    return `${value.toLocaleString(isHt ? 'fr-HT' : 'en-US', { minimumFractionDigits: 2 })} ${symbol}`;
  };

  // ─── Phase 7a — product FAQ editor ─────────────────────────────────
  const openFaqs = async (item) => {
    setFaqItem(item);
    setFaqFormOpen(false);
    setFaqEditing(null);
    setFaqLoading(true);
    try {
      const res = await businessProductFaqService.list(item.id);
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setFaqs(data);
    } catch {
      setFaqs([]);
      showToast?.(
        isHt ? 'Pa t kapab chaje FAQ atik la.' : 'Could not load the item FAQs.',
        'circle-exclamation',
      );
    } finally {
      setFaqLoading(false);
    }
  };

  const closeFaqs = () => {
    if (faqSaving) return;
    setFaqItem(null);
    setFaqs([]);
    setFaqFormOpen(false);
  };

  const openFaqCreate = () => {
    setFaqEditing(null);
    setFaqForm({ question: '', answer: '', status: 'active' });
    setFaqFormOpen(true);
  };

  const openFaqEdit = (faq) => {
    setFaqEditing(faq);
    setFaqForm({ question: faq.question || '', answer: faq.answer || '', status: faq.status || 'active' });
    setFaqFormOpen(true);
  };

  const setFaq = (key, value) => setFaqForm((prev) => ({ ...prev, [key]: value }));

  const submitFaq = async (e) => {
    e.preventDefault();
    if (!faqItem) return;
    if ((faqForm.question || '').trim().length < 3) {
      showToast?.(
        isHt ? 'Kesyon an twò kout (3 karaktè minimòm).' : 'Question is too short (3+ characters).',
        'circle-exclamation',
      );
      return;
    }
    if (!(faqForm.answer || '').trim()) {
      showToast?.(isHt ? 'Repons lan obligatwa.' : 'Answer is required.', 'circle-exclamation');
      return;
    }
    setFaqSaving(true);
    const payload = { question: faqForm.question.trim(), answer: faqForm.answer.trim(), status: faqForm.status };
    try {
      if (faqEditing) {
        const res = await businessProductFaqService.update(faqEditing.id, payload);
        const updated = res?.data?.data ?? res?.data ?? null;
        if (updated?.id) setFaqs((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        showToast?.(isHt ? '✅ FAQ mete ajou!' : '✅ FAQ updated!', 'check-circle');
      } else {
        const res = await businessProductFaqService.create({
          ...payload,
          catalog_item: faqItem.id,
          sort_order: faqs.length,
        });
        const created = res?.data?.data ?? res?.data ?? null;
        if (created?.id) setFaqs((prev) => [...prev, created]);
        showToast?.(isHt ? '✅ FAQ ajoute!' : '✅ FAQ added!', 'check-circle');
      }
      setFaqFormOpen(false);
      setFaqEditing(null);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.question?.[0]
        || err?.response?.data?.answer?.[0]
        || err?.response?.data?.catalog_item?.[0]
        || (isHt ? 'Pa t kapab sove FAQ la.' : 'Could not save the FAQ.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setFaqSaving(false);
    }
  };

  const moveFaq = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= faqs.length) return;
    const a = faqs[index];
    const b = faqs[target];
    setFaqBusyId(a.id);
    try {
      await businessProductFaqService.update(a.id, { sort_order: b.sort_order });
      const resB = await businessProductFaqService.update(b.id, { sort_order: a.sort_order });
      const updatedB = resB?.data?.data ?? resB?.data ?? null;
      setFaqs((prev) => prev
        .map((f) => (f.id === a.id ? { ...f, sort_order: b.sort_order } : f))
        .map((f) => (updatedB?.id && f.id === b.id ? updatedB : f)));
    } catch {
      showToast?.(
        isHt ? 'Pa t kapab reyòdone FAQ yo.' : 'Could not reorder FAQs.',
        'circle-exclamation',
      );
    } finally {
      setFaqBusyId(null);
    }
  };

  const toggleFaqStatus = async (faq) => {
    const next = faq.status === 'active' ? 'archived' : 'active';
    setFaqBusyId(faq.id);
    try {
      const res = await businessProductFaqService.update(faq.id, { status: next });
      const updated = res?.data?.data ?? res?.data ?? null;
      if (updated?.id) setFaqs((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch {
      showToast?.(isHt ? 'Aksyon an pa t mache.' : 'The action failed.', 'circle-exclamation');
    } finally {
      setFaqBusyId(null);
    }
  };

  const deleteFaq = async (faq) => {
    setFaqBusyId(faq.id);
    try {
      await businessProductFaqService.remove(faq.id);
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
      showToast?.(isHt ? 'FAQ la efase.' : 'FAQ deleted.', 'trash');
    } catch {
      showToast?.(
        isHt ? 'Pa t kapab efase FAQ la.' : 'Could not delete the FAQ.',
        'circle-exclamation',
      );
    } finally {
      setFaqBusyId(null);
    }
  };

  return (
    <div className="biz-catalog" data-testid="business-catalog">
      <div className="biz-catalog-header">
        <div>
          <h3 className="biz-catalog-title">
            <i className="fas fa-box-open" aria-hidden="true" />
            {t?.business_catalog || (isHt ? 'Katalòg' : 'Catalog')}
          </h3>
          <p className="biz-catalog-hint">
            {t?.business_catalog_hint || (isHt
              ? 'Atik sa yo fè pati Business Profile ou — yo pa parèt nan Explore ni nan Home Feed.'
              : 'These items belong to your Business Profile — they never appear in Explore or the Home Feed.')}
          </p>
        </div>
        <button
          type="button"
          className="biz-btn biz-btn-primary"
          onClick={openCreate}
          data-testid="business-catalog-add"
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {t?.business_catalog_add || (isHt ? 'Ajoute yon atik' : 'Add an item')}
        </button>
      </div>

      {loading ? (
        <div className="biz-catalog-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <div className="biz-catalog-empty" data-testid="business-catalog-empty">
          <i className="fas fa-box-open" aria-hidden="true" />
          <h4>{t?.business_catalog_empty || (isHt ? 'Katalòg la vid' : 'The catalog is empty')}</h4>
          <p>
            {t?.business_catalog_empty_hint || (isHt
              ? 'Ajoute pwodwi oswa sèvis ou yo. Atik aktif yo ap parèt sou paj piblik biznis ou.'
              : 'Add your products or services. Active items will appear on your public business page.')}
          </p>
        </div>
      ) : (
        <div className="biz-catalog-grid">
          {items.map((item) => {
            const color = STATUS_COLORS[item.status] || '#94a3b8';
            return (
              <article key={item.id} className="biz-cat-card" data-testid="business-catalog-item">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} loading="lazy" className="biz-cat-card-img" />
                ) : (
                  <div className="biz-cat-card-img biz-cat-card-img-placeholder">
                    <i className="fas fa-cube" aria-hidden="true" />
                  </div>
                )}
                <div className="biz-cat-card-body">
                  <div className="biz-cat-card-title-row">
                    <h4 className="biz-cat-card-title">{item.name}</h4>
                    <span
                      className="biz-status-pill"
                      style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
                    >
                      {t?.[`business_catalog_status_${item.status}`] || STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>
                  {item.category && (
                    <span className="biz-cat-card-category">
                      <i className="fas fa-tag" aria-hidden="true" />
                      {item.category}
                    </span>
                  )}
                  <div className="biz-cat-card-price">{formatPrice(item)}</div>
                  {item.description && (
                    <p className="biz-cat-card-desc">{item.description}</p>
                  )}

                  <div className="biz-cat-card-actions">
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost biz-btn-sm"
                      onClick={() => openEdit(item)}
                      disabled={busyId === item.id}
                      data-testid="business-catalog-edit"
                    >
                      <i className="fas fa-pen" aria-hidden="true" />
                      {isHt ? 'Modifye' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost biz-btn-sm"
                      onClick={() => openFaqs(item)}
                      disabled={busyId === item.id}
                      data-testid="business-catalog-faqs"
                    >
                      <i className="fas fa-circle-question" aria-hidden="true" />
                      {t?.business_catalog_faqs || (isHt ? 'FAQ' : 'FAQ')}
                    </button>
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost biz-btn-sm"
                      onClick={() => toggleStatus(item)}
                      disabled={busyId === item.id}
                      title={item.status === 'active' ? (isHt ? 'Achive' : 'Archive') : (isHt ? 'Re-aktive' : 'Reactivate')}
                    >
                      <i className={`fas ${item.status === 'active' ? 'fa-box-archive' : 'fa-circle-play'}`} aria-hidden="true" />
                      {item.status === 'active' ? (isHt ? 'Achive' : 'Archive') : (isHt ? 'Aktive' : 'Activate')}
                    </button>
                    {confirmDeleteId === item.id ? (
                      <button
                        type="button"
                        className="biz-btn biz-btn-danger biz-btn-sm"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                        data-testid="business-catalog-delete-confirm"
                      >
                        <i className="fas fa-trash" aria-hidden="true" />
                        {isHt ? 'Konfime?' : 'Confirm?'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="biz-btn biz-btn-danger biz-btn-sm"
                        onClick={() => setConfirmDeleteId(item.id)}
                        disabled={busyId === item.id}
                        data-testid="business-catalog-delete"
                      >
                        <i className="fas fa-trash" aria-hidden="true" />
                        {isHt ? 'Efase' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ─── Phase 7a — product FAQ manager modal ──────────────── */}
      {faqItem && (
        <div className="biz-modal-overlay" onClick={closeFaqs} role="presentation">
          <div
            className="biz-modal biz-modal-lg"
            role="dialog"
            aria-modal="true"
            aria-label={isHt ? `FAQ: ${faqItem.name}` : `FAQs: ${faqItem.name}`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-circle-question" aria-hidden="true" />
                {t?.business_catalog_faqs_title || (isHt ? 'FAQ atik la' : 'Item FAQs')}: {faqItem.name}
              </h3>
              <button type="button" className="biz-modal-close" onClick={closeFaqs} aria-label={isHt ? 'Fèmen' : 'Close'}>
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <p className="biz-modal-hint">
              {t?.business_product_faqs_hint || (isHt
                ? 'Kesyon espesifik pou pwodui/sèvis sa a — yo ap parèt anba atik la sou paj piblik la.'
                : 'Item-specific questions — they appear under this product on the public page.')}
            </p>

            {faqLoading ? (
              <div className="biz-catalog-loading">
                <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
              </div>
            ) : (
              <>
                {faqs.length === 0 && !faqFormOpen ? (
                  <div className="biz-catalog-empty" data-testid="business-catalog-faq-empty">
                    <i className="fas fa-circle-question" aria-hidden="true" />
                    <h4>{t?.business_faq_empty || (isHt ? 'Pokò gen FAQ' : 'No FAQs yet')}</h4>
                  </div>
                ) : (
                  <div className="biz-faq-list biz-faq-list-compact">
                    {faqs.map((faq, index) => {
                      const color = faq.status === 'active' ? '#34d399' : (faq.status === 'draft' ? '#fbbf24' : '#94a3b8');
                      return (
                        <article className="biz-faq-row" key={faq.id} data-testid="business-catalog-faq-item">
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
                            <button type="button" className="biz-btn biz-btn-ghost biz-btn-sm"
                              onClick={() => moveFaq(index, -1)} disabled={faqBusyId === faq.id || index === 0}
                              aria-label={isHt ? 'Moute' : 'Move up'}>
                              <i className="fas fa-arrow-up" aria-hidden="true" />
                            </button>
                            <button type="button" className="biz-btn biz-btn-ghost biz-btn-sm"
                              onClick={() => moveFaq(index, 1)} disabled={faqBusyId === faq.id || index === faqs.length - 1}
                              aria-label={isHt ? 'Desann' : 'Move down'}>
                              <i className="fas fa-arrow-down" aria-hidden="true" />
                            </button>
                            <button type="button" className="biz-btn biz-btn-ghost biz-btn-sm"
                              onClick={() => toggleFaqStatus(faq)} disabled={faqBusyId === faq.id}
                              title={faq.status === 'active' ? (isHt ? 'Achive' : 'Archive') : (isHt ? 'Aktive' : 'Activate')}>
                              <i className={`fas ${faq.status === 'active' ? 'fa-box-archive' : 'fa-circle-play'}`} aria-hidden="true" />
                            </button>
                            <button type="button" className="biz-btn biz-btn-ghost biz-btn-sm"
                              onClick={() => openFaqEdit(faq)} disabled={faqBusyId === faq.id}
                              data-testid="business-catalog-faq-edit">
                              <i className="fas fa-pen" aria-hidden="true" />
                            </button>
                            <button type="button" className="biz-btn biz-btn-danger biz-btn-sm"
                              onClick={() => { if (window.confirm(isHt ? 'Efase FAQ sa a?' : 'Delete this FAQ?')) deleteFaq(faq); }}
                              disabled={faqBusyId === faq.id}
                              data-testid="business-catalog-faq-delete">
                              <i className="fas fa-trash" aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {faqFormOpen ? (
                  <form onSubmit={submitFaq} className="biz-form biz-faq-form-inline" data-testid="business-catalog-faq-form">
                    <div className="biz-form-group">
                      <label className="biz-form-label">
                        {t?.business_faq_question || (isHt ? 'Kesyon' : 'Question')} *
                      </label>
                      <input type="text" className="biz-form-input" value={faqForm.question}
                        onChange={(e) => setFaq('question', e.target.value)} maxLength={300}
                        data-testid="business-catalog-faq-question" required autoFocus />
                    </div>
                    <div className="biz-form-group">
                      <label className="biz-form-label">
                        {t?.business_faq_answer || (isHt ? 'Repons' : 'Answer')} *
                      </label>
                      <textarea className="biz-form-input" rows={2} value={faqForm.answer}
                        onChange={(e) => setFaq('answer', e.target.value)} maxLength={2000}
                        data-testid="business-catalog-faq-answer" />
                    </div>
                    <div className="biz-form-group">
                      <label className="biz-form-label">
                        {t?.business_catalog_field_status || (isHt ? 'Estati' : 'Status')}
                      </label>
                      <select className="biz-form-input" value={faqForm.status}
                        onChange={(e) => setFaq('status', e.target.value)}>
                        <option value="active">{isHt ? 'Aktif' : 'Active'}</option>
                        <option value="draft">{isHt ? 'Brouyon' : 'Draft'}</option>
                        <option value="archived">{isHt ? 'Achive' : 'Archived'}</option>
                      </select>
                    </div>
                    <div className="biz-form-actions">
                      <button type="button" className="biz-btn biz-btn-ghost" onClick={() => setFaqFormOpen(false)} disabled={faqSaving}>
                        {isHt ? 'Anile' : 'Cancel'}
                      </button>
                      <button type="submit" className="biz-btn biz-btn-primary" disabled={faqSaving}
                        data-testid="business-catalog-faq-submit">
                        <i className={`fas ${faqSaving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
                        {faqEditing ? (isHt ? 'Sove' : 'Save') : (isHt ? 'Ajoute' : 'Add')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="biz-form-actions" style={{ marginTop: 14 }}>
                    <button type="button" className="biz-btn biz-btn-primary" onClick={openFaqCreate}
                      data-testid="business-catalog-faq-add">
                      <i className="fas fa-plus" aria-hidden="true" />
                      {t?.business_faq_add || (isHt ? 'Ajoute yon FAQ' : 'Add a FAQ')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {formOpen && (
        <div className="biz-modal-overlay" onClick={() => { if (!saving) setFormOpen(false); }} role="presentation">
          <div
            className="biz-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? (isHt ? 'Modifye atik la' : 'Edit item') : (isHt ? 'Ajoute yon atik' : 'Add an item')}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-box-open" aria-hidden="true" />
                {editing
                  ? (t?.business_catalog_edit || (isHt ? 'Modifye atik la' : 'Edit item'))
                  : (t?.business_catalog_add || (isHt ? 'Ajoute yon atik' : 'Add an item'))}
              </h3>
              <button type="button" className="biz-modal-close" onClick={() => { if (!saving) setFormOpen(false); }} aria-label={isHt ? 'Fèmen' : 'Close'}>
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="biz-form" data-testid="business-catalog-form">
              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_catalog_field_name || (isHt ? 'Non pwodwi / sèvis' : 'Product / service name')} *
                </label>
                <input
                  type="text"
                  className="biz-form-input"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  maxLength={160}
                  placeholder={isHt ? 'Egzanp: Konsepsyon logo' : 'e.g. Logo design'}
                  data-testid="business-catalog-name"
                  required
                  autoFocus
                />
              </div>

              <div className="biz-form-row">
                <div className="biz-form-group">
                  <label className="biz-form-label">
                    {t?.business_catalog_field_category || (isHt ? 'Kategori' : 'Category')}
                  </label>
                  <input
                    type="text"
                    className="biz-form-input"
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    maxLength={60}
                    placeholder={isHt ? 'Egzanp: Sèvis' : 'e.g. Services'}
                  />
                </div>
                <div className="biz-form-group">
                  <label className="biz-form-label">
                    {t?.business_catalog_field_price || (isHt ? 'Pri' : 'Price')}
                  </label>
                  <div className="biz-cat-price-row">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="biz-form-input"
                      value={form.price}
                      onChange={(e) => set('price', e.target.value)}
                      placeholder="0.00"
                      data-testid="business-catalog-price"
                    />
                    <input
                      type="text"
                      className="biz-form-input biz-cat-currency"
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value)}
                      maxLength={3}
                      placeholder="USD"
                      title={isHt ? 'Kòd lajan (USD, HTG, EUR)' : 'Currency code (USD, HTG, EUR)'}
                    />
                  </div>
                </div>
              </div>

              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_catalog_field_image || (isHt ? 'Imaj (URL)' : 'Image (URL)')}
                </label>
                <input
                  type="url"
                  className="biz-form-input"
                  value={form.image_url}
                  onChange={(e) => set('image_url', e.target.value)}
                  placeholder="https://…/item.png"
                />
                {form.image_url && (
                  <img src={form.image_url} alt="preview" loading="lazy" className="biz-logo-preview" />
                )}
              </div>

              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_catalog_field_description || (isHt ? 'Deskripsyon' : 'Description')}
                </label>
                <textarea
                  className="biz-form-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={3000}
                  placeholder={isHt ? 'Kisa atik sa a ye...' : 'What this item is...'}
                />
              </div>

              {editing && (
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
              )}

              <div className="biz-form-actions">
                <button type="button" className="biz-btn biz-btn-ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                  {isHt ? 'Anile' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="biz-btn biz-btn-primary"
                  disabled={saving}
                  data-testid="business-catalog-submit"
                >
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
                  {saving
                    ? (isHt ? 'Ap sove...' : 'Saving...')
                    : (editing ? (isHt ? 'Sove chanjman' : 'Save changes') : (isHt ? 'Ajoute atik' : 'Add item'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
