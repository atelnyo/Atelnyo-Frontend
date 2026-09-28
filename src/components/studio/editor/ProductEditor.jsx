/**
 * src/components/studio/editor/ProductEditor.jsx
 *
 * EDITOR-FIRST product creation/editing workspace (replaces
 * ProductFormModal).
 *
 * Product is SHOP CONTENT, so the workspace leads with the item:
 *   • CENTER — product image canvas + name + description
 *   • RIGHT  — contextual properties: type, category, tags, image, price
 *
 * SAVE vs PUBLISH are REAL different states here — the marketplace
 * Product model has ``is_active`` (the publish flag):
 *   • Save draft → is_active=false (hidden from the marketplace)
 *   • Publish    → is_active=true  (live for buyers)
 * Autosave preserves the current visibility.
 *
 * PRODUCT KINDS (backend: Product.KIND_CHOICES) drive contextual
 * panels — inventory for physical, the download resource for digital,
 * delivery notes for services. Only backend-supported fields are
 * exposed; the canvas always leads with the product itself.
 *
 * EXTENSION POINTS (architecture only — nothing faked):
 *   • Variants / bundles / collections / SEO need new backend fields
 *     (SKUs, variant combos, bundle members) — not implemented; the
 *     properties panel would grow accordions per feature.
 *   • Product analytics / orders: the backend OrderViewSet has a
 *     ``sales`` endpoint but no studio UI consumes it yet — wire it
 *     into a dashboard section when the orders surface exists.
 *   • Media library picker: reuse the existing Media section assets
 *     when the media API exposes a selectable library endpoint.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api, { marketplaceService } from '../../../services/api';
import useSafeNavigate from '../../../hooks/useSafeNavigate';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import ProductDetail from '../../ProductDetail';
import MediaUploadButton from './MediaUploadButton';
import './MediaUploadButton.css';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, {
  PropertyGroup, PropField, PropInput, PropSelect, PropTextarea, PropToggle,
} from './StudioPropertiesPanel';
import { ImageUrlField, HelpTip, HELP_COPY } from '../modals/shared';
import ProductVariantsPanel from './ProductVariantsPanel';
import styles from './editor.module.css';

export default function ProductEditor({ onClose, onSuccess, lang = 'ht', showToast, user, item, kind = 'digital' }) {
  const isEdit = Boolean(item);
  const navigate = useSafeNavigate();
  const isHt = lang === 'ht';
  const isPremium = !!(user?.premium?.is_premium);
  // Kind of product — from the creation chooser or the edited item.
  // Backend-discriminated: digital → download_url, physical → stock,
  // service → delivery note.
  const productKind = item?.kind || kind || 'digital';

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    price: item?.price ?? '',
    category: item?.category || '',
    image_url: item?.image_url || '',
    kind: productKind,
    is_active: item?.is_active ?? true,
    hashtags: hashtagsToInput(item?.tags),
    // Kind-specific fields (backend-supported):
    //   digital → the resource customers receive
    //   physical → inventory (blank = unlimited)
    download_url: item?.download_url || '',
    stock: item?.stock ?? '',
  });
  // ─── Variants (real backend: ProductVariant model) ────────────────
  // Managed through the variant endpoint once the product exists;
  // editing an existing product preloads them from the serializer.
  const [variants, setVariants] = useState(
    Array.isArray(item?.variants) ? item.variants.map((v) => ({ ...v })) : [],
  );
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [hasSaved, setHasSaved] = useState(isEdit);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const savedIdRef = useRef(isEdit ? item.id : null);
  const autoSaveTimer = useRef(null);
  // ``dirty`` state drives the shell's unsaved-changes guard; the ref
  // mirrors it for effects/handlers only.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      setSaveState('dirty');
    }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  // ─── Validation (mirrors ProductFormModal) ───────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      errs.price = isHt ? 'Pri valab oblije' : 'A valid price is required';
    }
    if (form.kind === 'digital' && form.download_url.trim() && !/^https?:\/\//i.test(form.download_url.trim())) {
      errs.download_url = isHt ? 'URL la dwe kòmanse ak http(s)://' : 'The URL must start with http(s)://';
    }
    return errs;
  }, [form.title, form.price, form.download_url, form.kind, isHt]);

  // ─── Publish-readiness checklist (real rules, clickable) ─────────────
  const readiness = useCallback(() => {
    const items = [];
    if (!form.title.trim()) items.push({ message: isHt ? 'Ajoute yon non pwodwi' : 'Add the product name', target: 'canvas' });
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      items.push({ message: isHt ? 'Fikse yon pri valab' : 'Set a valid price', target: 'props' });
    }
    if (!form.image_url.trim()) items.push({ message: isHt ? 'Ajoute yon foto pwodwi' : 'Add a product photo', target: 'props' });
    // Digital products: the resource customers receive. Recommended, not
    // a hard block — buyers can still contact the seller per the
    // storefront disclaimer.
    if (form.kind === 'digital' && !form.download_url.trim()) {
      items.push({ message: isHt ? 'Ajoute resous livrezon an (fichye/lyen)' : 'Add the delivery resource (file/link)', target: 'props' });
    }
    return items;
  }, [form.title, form.price, form.image_url, form.download_url, form.kind, isHt]);

  const doSave = useCallback(async (publish) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveState('dirty');
      showToast?.(isHt ? 'Gen jaden ki pa konplè — tcheke yo.' : 'Some fields are incomplete — check them.', 'circle-exclamation');
      return false;
    }
    setErrors({});
    setSaveState('saving');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      tags: parseHashtags(form.hashtags),
      price: Number(form.price),
      category: form.category || undefined,
      image_url: form.image_url.trim() || undefined,
      kind: form.kind || 'digital',
      is_active: publish ?? form.is_active,
      // Kind-specific fields (backend accepts these on any kind).
      // Empty string / null clear the field — undefined would silently
      // keep the previous value on PUT.
      download_url: form.kind === 'digital' ? form.download_url.trim() : '',
      stock: form.kind === 'physical' ? (form.stock === '' ? null : Number(form.stock)) : undefined,
    };
    try {
      let saved;
      if (savedIdRef.current) {
        saved = await marketplaceService.update(savedIdRef.current, payload);
      } else {
        const res = await api.post('marketplace/products/', payload);
        saved = res.data;
      }
      if (saved?.id) savedIdRef.current = saved.id;
      setHasSaved(true);
      if (typeof saved?.is_active === 'boolean') {
        setForm((f) => ({ ...f, is_active: saved.is_active }));
      }
      dirtyRef.current = false;
      setDirty(false);
      setSaveState('saved');
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0]
        || err?.message
        || (isHt ? 'Pa t kapab sove pwodwi a.' : 'Could not save the product.');
      setSaveState('error');
      showToast?.(detail, 'circle-exclamation');
      return false;
    }
  }, [form, validate, isHt, showToast]);

  // ─── Debounced autosave after the product exists ─────────────────────
  useEffect(() => {
    if (!dirtyRef.current || saveState === 'saving' || !savedIdRef.current) return undefined;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { doSave(); }, 2200);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, saveState, doSave]);

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, []);

  const handleSaveDraft = useCallback(() => { doSave(false); }, [doSave]);
  const handlePublish = useCallback(() => { doSave(true); }, [doSave]);

  // ─── Variant sync (real create/update/delete on the backend) ───────
  const syncVariants = useCallback(async () => {
    // Reload variants from the backend after any change so the list
    // always reflects server state.
    if (!savedIdRef.current) return;
    try {
      const res = await marketplaceService.variants(savedIdRef.current);
      const list = Array.isArray(res?.data?.results || res?.data) ? (res?.data?.results || res?.data) : [];
      setVariants(list);
    } catch (e) { /* keep current list on failure */ }
  }, []);

  const addVariant = useCallback(async (v) => {
    if (!savedIdRef.current) return;
    try {
      await marketplaceService.createVariant({ product_id: savedIdRef.current, ...v });
      await syncVariants();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.name?.[0]
        || err?.message || (isHt ? 'Pa t kapab ajoute variant.' : 'Could not add the variant.');
      showToast?.(detail, 'circle-exclamation');
    }
  }, [syncVariants, isHt, showToast]);

  const updateVariant = useCallback(async (id, patch) => {
    try {
      await marketplaceService.updateVariant(id, patch);
      await syncVariants();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || (isHt ? 'Pa t kapab mete ajou variant.' : 'Could not update the variant.');
      showToast?.(detail, 'circle-exclamation');
    }
  }, [syncVariants, isHt, showToast]);

  const removeVariant = useCallback(async (id) => {
    try {
      await marketplaceService.deleteVariant(id);
      await syncVariants();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || (isHt ? 'Pa t kapab efase variant.' : 'Could not delete the variant.');
      showToast?.(detail, 'circle-exclamation');
    }
  }, [syncVariants, isHt, showToast]);

  const handlePreview = useCallback(() => {
    const preview = {
      id: savedIdRef.current || 'draft-preview',
      slug: form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'draft-product',
      title: form.title.trim() || (isHt ? 'Pwodwi Sans Tit' : 'Untitled product'),
      description: form.description.trim(),
      price: Number(form.price) || 0,
      currency: 'USD',
      kind: form.kind || 'digital',
      image_url: form.image_url.trim(),
      download_url: form.download_url.trim(),
      category: form.category || 'General',
      seller_username: user?.username || 'you',
      is_active: form.is_active,
      tags: parseHashtags(form.hashtags),
      variants: variants || [],
      avg_rating: 0,
      review_count: 0,
      sales_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (savedIdRef.current && form.is_active !== false) {
      navigate(`/marketplace/${savedIdRef.current}`);
      return;
    }

    setPreviewProduct(preview);
    setPreviewOpen(true);
  }, [form, isHt, navigate, user, variants]);

  const isLive = form.is_active;
  const kindBadge = {
    digital: isHt ? 'Dijital' : 'Digital',
    physical: isHt ? 'Fizik' : 'Physical',
    service: isHt ? 'Sèvis' : 'Service',
  }[form.kind] || (isHt ? 'Pwodwi' : 'Product');

  // ─── Status badge for the shell header (spec 36: status obvious) ─────
  const statusBadge = (
    <span className={`${styles.deliveryBadge} ${isLive ? styles.deliveryBadgeOnline : styles.deliveryBadgeExternal}`}>
      <i className={`fas ${isLive ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
      {isLive ? (isHt ? 'Pibliye' : 'Published') : (isHt ? 'Bouyon' : 'Draft')}
    </span>
  );

  const kindLabel = {
    digital: isHt ? 'Dijital' : 'Digital',
    physical: isHt ? 'Fizik' : 'Physical',
    service: isHt ? 'Sèvis' : 'Service',
    subscription: isHt ? 'Abònman' : 'Subscription',
  }[form.kind] || form.kind;

  // ─── Media-first canvas ──────────────────────────────────────────────
  const editorPanel = (
    <div className={styles.editorSection}>
      <header className={styles.editorSectionHeader}>
        <span className={styles.editorSectionIcon}>
          <i className="fas fa-cube" aria-hidden="true" />
        </span>
        <div>
          <h2 className={styles.editorSectionTitle}>{isHt ? 'Workshop Pwodwi' : 'Product Workspace'}</h2>
          <p className={styles.editorSectionHint}>
            {isHt ? 'Foto, non ak deskripsyon pwodwi a.' : 'Product photo, name and description.'}
          </p>
        </div>
      </header>
      <div className={`${styles.canvas} ${styles.mediaCanvas}`}>
        <div className={styles.mediaPreview}>
          {form.image_url ? (
            <img src={form.image_url} alt={isHt ? 'Foto pwodwi' : 'Product photo'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className={styles.mediaPreviewPlaceholder}>
              <i className="fas fa-box-open" aria-hidden="true" />
              <span>{isHt ? 'Ajoute yon foto pwodwi (jaden Medya a)' : 'Add a product photo (via the Media panel)'}</span>
            </div>
          )}
          <span className={styles.mediaPreviewBadge}>
            <i className={`fas ${isLive ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
            {kindBadge} · {isLive ? (isHt ? 'Pibliye' : 'Published') : (isHt ? 'Bouyon' : 'Draft')}
          </span>
        </div>

        <input
          className={styles.canvasTitle}
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder={isHt ? 'Non pwodwi a...' : 'Product name…'}
          maxLength={200}
          aria-invalid={errors.title ? 'true' : 'false'}
        />
        {errors.title && (
          <span className={styles.propsError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.title}
          </span>
        )}
        <PropTextarea
          className={styles.canvasBody}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder={isHt ? 'Dekri sa achtè a pral resevwa...' : 'Describe what the buyer receives…'}
          rows={8}
          maxLength={5000}
        />
      </div>
    </div>
  );

  // ─── Properties ──────────────────────────────────────────────────────
  const propsPanel = (
    <>
      <PropertyGroup icon="fa-circle-info" label="Basic Information" labelHt="Enfòmasyon Bazik" lang={lang} defaultOpen>
        <PropField label="Type" labelHt="Kalite" lang={lang}>
          <PropSelect value={form.kind} onChange={(e) => handleChange('kind', e.target.value)}>
            <option value="digital">{isHt ? 'Dijital' : 'Digital'}</option>
            <option value="physical">{isHt ? 'Fizik' : 'Physical'}</option>
            <option value="service">{isHt ? 'Sèvis' : 'Service'}</option>
          </PropSelect>
        </PropField>
        <PropField label="Category" labelHt="Kategori" lang={lang}>
          <PropInput
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder={isHt ? 'Modèl, Liv, Mizik...' : 'Template, Book, Music…'}
          />
        </PropField>
      </PropertyGroup>

      <PropertyGroup icon="fa-hashtag" label="Discovery" labelHt="Dekouvèt" lang={lang}>
        <PropField
          label="Hashtags"
          labelHt="Hashtags"
          lang={lang}
          hint={isHt ? 'Separe ak espas — #Kreyol #Art' : 'Separate with spaces — #Kreyol #Art'}
        >
          <PropInput
            value={form.hashtags}
            onChange={(e) => handleChange('hashtags', e.target.value)}
            placeholder="#Kreyol #Art #Fashion"
            maxLength={120}
          />
        </PropField>
      </PropertyGroup>

      <PropertyGroup icon="fa-shapes" label="Variants" labelHt="Variants" lang={lang}>
        <ProductVariantsPanel
          lang={lang}
          variants={variants}
          canEdit={Boolean(savedIdRef.current)}
          onAdd={addVariant}
          onUpdate={updateVariant}
          onRemove={removeVariant}
        />
      </PropertyGroup>

      <PropertyGroup icon="fa-image" label="Media" labelHt="Medya" lang={lang}>
        <MediaUploadButton
          value={form.image_url}
          onChange={(v) => handleChange('image_url', v)}
          kind="image"
          label={isHt ? 'Imaj Pwodwi' : 'Product Image'}
          placeholder="https://example.com/product.jpg"
          isPremium={isPremium}
          required
          lang={lang}
        />
      </PropertyGroup>

      <PropertyGroup icon="fa-tag" label="Access & Price" labelHt="Aksè & Pri" lang={lang}>
        <PropField label="Price ($)" labelHt="Pri ($)" lang={lang} required error={errors.price}>
          <PropInput
            type="number"
            min="0.50"
            step="0.50"
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="9.99"
          />
        </PropField>
      </PropertyGroup>

      {/* ─── Kind-specific delivery/inventory (contextual) ────── */}
      {form.kind === 'digital' && (
        <PropertyGroup icon="fa-file-arrow-down" label="Delivery" labelHt="Livrezon" lang={lang}>
          <PropField
            label="Download URL"
            labelHt="URL Telechajman"
            lang={lang}
            error={errors.download_url}
            hint={isHt
              ? 'Fichye oswa lyen achtè a resevwa apre acha (PDF, ZIP, imaj, videyo...).'
              : 'The file or link the buyer receives after purchase (PDF, ZIP, image, video…).'}
          >
            <PropInput
              type="url"
              value={form.download_url}
              onChange={(e) => handleChange('download_url', e.target.value)}
              placeholder="https://example.com/file.zip"
            />
          </PropField>
          <p className={styles.propsHint}>
            {isHt
              ? 'Sou paj piblik la, si resous lan la, achtè a jwenn li dirèkteman; sinon li kontakte w (Checkout la jere pa platfòm nan).'
              : 'On the public page, if the resource is set the buyer gets it directly; otherwise they contact you (checkout is handled by the platform).'}
          </p>
        </PropertyGroup>
      )}

      {form.kind === 'physical' && (
        <PropertyGroup icon="fa-boxes-stacked" label="Inventory" labelHt="Envantè" lang={lang}>
          <PropField
            label="Stock quantity"
            labelHt="Kantite stock"
            lang={lang}
            hint={isHt ? 'Kite vid si stock la pa limite.' : 'Leave empty for unlimited stock.'}
          >
            <PropInput
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => handleChange('stock', e.target.value)}
              placeholder={isHt ? 'Illimite' : 'Unlimited'}
            />
          </PropField>
          <p className={styles.propsHint}>
            {isHt
              ? 'Paj piblik la montre stock la — "0" parèt kòm pa gen stock. Acha a mande adrès livrezon nan checkout la.'
              : 'The public page shows stock — "0" renders as out of stock. Checkout requires a shipping address.'}
          </p>
        </PropertyGroup>
      )}

      {form.kind === 'service' && (
        <PropertyGroup icon="fa-hand-sparkles" label="Delivery" labelHt="Livrezon" lang={lang}>
          <p className={styles.propsHint}>
            {isHt
              ? 'Yon sèvis pa gen fichye ni stock. Achtè a achte sèvis la epi checkout la jere rezèvasyon/kontak — esplike mòd livrezon an (online, an pèsòn, kote...) nan deskripsyon an.'
              : 'A service has no file or inventory. Buyers purchase the service and checkout handles booking/contact — explain the delivery method (online, in-person, location…) in the description.'}
          </p>
        </PropertyGroup>
      )}

      <PropertyGroup icon="fa-rocket" label="Publishing" labelHt="Piblikasyon" lang={lang}>
        <PropToggle
          checked={isLive}
          onChange={(v) => handleChange('is_active', v)}
          label={isLive ? 'Visible sou Marketplace' : 'Cache (bouyon)'}
          labelHt={isLive ? 'Visible sou Marketplace' : 'Kache (bouyon)'}
          lang={lang}
        />
        <p className={styles.propsHint}>
          {isHt
            ? 'Yon pwodwi bouyon kache pou achtè yo. Pibliye l sèlman lè l pare.'
            : 'A draft product is hidden from buyers. Publish it only when it’s ready.'}
        </p>
      </PropertyGroup>
    </>
  );

  return (
    <>
      <StudioEditorShell
        title={isHt ? 'Editè Pwodwi' : 'Product Editor'}
        icon="fa-cube"
        lang={lang}
        docTitle={form.title.trim()}
        isNew={!isEdit}
        badge={statusBadge}
        dirty={dirty}
        saveState={saveState}
        onBack={onClose}
        onPreview={handlePreview}
        onSave={handleSaveDraft}
        saveLabel={hasSaved ? (isHt ? 'Sove Bouyon' : 'Save Draft') : (isHt ? 'Kreye Pwodwi' : 'Create Product')}
        canSave
        onPublish={handlePublish}
        publishLabel={isHt ? 'Pibliye' : 'Publish'}
        validation={readiness()}
        onFixValidation={() => {}}
        editor={editorPanel}
        properties={<StudioPropertiesPanel lang={lang}>{propsPanel}</StudioPropertiesPanel>}
      />

      {previewOpen && previewProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 3000, overflowY: 'auto' }}>
          <div style={{ position: 'relative', minHeight: '100%' }}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{ position: 'absolute', top: 18, right: 18, zIndex: 1, border: 'none', borderRadius: 999, width: 42, height: 42, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              aria-label={isHt ? 'Fèmen preview' : 'Close preview'}
            >
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
            <ProductDetail
              lang={lang}
              product={previewProduct}
              user={user}
              showToast={showToast}
              onBack={() => setPreviewOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
