/**
 * src/components/admin/AdminPlatformConfig.jsx
 *
 * Admin section for editing runtime platform configuration + API keys
 * (PlatformConfig key-value store). Staff can change PayPal, Firebase
 * (notifications), Stripe, Gemini, Sentry and general platform settings
 * WITHOUT a redeploy — the services read get_config() at request time.
 *
 * Secret rows (API keys, tokens) are MASKED by the backend: the UI shows
 * ``••••••••last4`` and can only WRITE a replacement. Leaving the masked
 * value untouched keeps the deployed secret (the backend treats it as a
 * masked echo). Emptying a secret and saving clears it.
 *
 * API:
 *   GET   /api/admin/platform-config/   — list config rows
 *   PATCH /api/admin/platform-config/<id>/ — update a typed value
 *   POST  /api/admin/platform-config/   — create a new key (typed)
 *
 * Route: /sheet/admin/config (wired into AdminDashboard quick links).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminPlatformConfigService } from '../../services/api';

// ─── Human labels for known config keys (EN + HT) ─────────────────────
const KEY_LABELS = {
  // Payments
  paypal_client_id:     { en: 'PayPal Client ID',            ht: 'PayPal ID Kliyan' },
  paypal_client_secret: { en: 'PayPal Client Secret',        ht: 'PayPal Sekrè Kliyan' },
  paypal_webhook_id:    { en: 'PayPal Webhook ID',           ht: 'PayPal Webhook ID' },
  paypal_mode:          { en: 'PayPal Mode',                 ht: 'PayPal Mode' },
  stripe_secret_key:    { en: 'Stripe Secret Key',           ht: 'Stripe Kle Sekrè' },
  stripe_webhook_secret:{ en: 'Stripe Webhook Secret',       ht: 'Stripe Webhook Sekrè' },
  // Notifications
  firebase_server_key:        { en: 'Firebase Server Key',   ht: 'Firebase Kle Sèvè' },
  firebase_credentials_json:  { en: 'Firebase Service Account JSON', ht: 'Firebase JSON Kont Sèvis' },
  push_notifications_enabled: { en: 'Push Notifications',    ht: 'Notifikasyon Pous' },
  // Firebase Web Config (public)
  firebase_api_key:             { en: 'Firebase API Key',            ht: 'Firebase Kle API' },
  firebase_auth_domain:         { en: 'Firebase Auth Domain',        ht: 'Firebase Domèn Otantifikasyon' },
  firebase_database_url:        { en: 'Firebase Database URL',       ht: 'Firebase URL Baz Done' },
  firebase_project_id:          { en: 'Firebase Project ID',         ht: 'Firebase ID Pwojè' },
  firebase_storage_bucket:      { en: 'Firebase Storage Bucket',     ht: 'Firebase Bokit Stokaj' },
  firebase_messaging_sender_id: { en: 'Firebase Sender ID',          ht: 'Firebase ID Expediteur' },
  firebase_app_id:              { en: 'Firebase App ID',             ht: 'Firebase ID Aplikasyon' },
  firebase_measurement_id:      { en: 'Firebase Measurement ID',     ht: 'Firebase ID Mestiraj' },
  firebase_vapid_key:           { en: 'Firebase VAPID Key',          ht: 'Firebase Kle VAPID' },
  // AI & Monitoring
  gemini_api_key:       { en: 'Gemini API Key',              ht: 'Gemini Kle API' },
  ai_services_enabled:  { en: 'AI Services',                 ht: 'Sèvis AI' },
  sentry_dsn:           { en: 'Sentry DSN',                  ht: 'Sentry DSN' },
  // Authentication
  google_client_id:     { en: 'Google Client ID',            ht: 'Google Kle Kliyan' },
  // General
  signups_enabled:      { en: 'Signups Enabled',             ht: 'Enskripsyon Aktive' },
  creator_apply_enabled:{ en: 'Creator Applications',        ht: 'Aplikasyon Kreyatè' },
  marketplace_enabled:  { en: 'Marketplace',                 ht: 'Marketplace' },
  max_upload_mb:        { en: 'Max Upload (MB)',             ht: 'Max Upload (MB)' },
  session_timeout_minutes: { en: 'Session Timeout (min)',    ht: 'Tan Session (min)' },
  maintenance_message:  { en: 'Maintenance Message',         ht: 'Mesaj Maintnans' },
  data_retention_days:  { en: 'Data Retention (days)',       ht: 'Retansyon Done (jou)' },
  rate_limit_global:    { en: 'Global Rate Limit',           ht: 'Limit Global' },
  wallet_topup_min:     { en: 'Wallet Top-up Minimum ($)',   ht: 'Minimòm Depo ($)' },
  wallet_topup_max:     { en: 'Wallet Top-up Maximum ($)',   ht: 'Maksimòm Depo ($)' },
  // SEO / Verification / Tracking
  custom_head_html:            { en: 'Custom Head HTML / Scripts', ht: 'HTML / Script Tèt Custom' },
  facebook_domain_verification: { en: 'Facebook Domain Verification', ht: 'Verifyasyon Domèn Facebook' },
  google_site_verification:    { en: 'Google Site Verification', ht: 'Verifyasyon Sit Google' },
  google_analytics_id:         { en: 'Google Analytics ID', ht: 'Google Analytics ID' },
  facebook_pixel_id:           { en: 'Meta (Facebook) Pixel ID', ht: 'Meta (Facebook) Pixel ID' },
};

// Keys that render as a multi-line <textarea> instead of a single-line
// input (long raw HTML/script snippets).
const MULTILINE_KEYS = new Set(['custom_head_html']);

// ─── Grouped sections shown in the panel ──────────────────────────────
const CONFIG_GROUPS = [
  {
    key: 'payments',
    icon: 'fa-credit-card',
    title: { en: 'Payments', ht: 'Peman' },
    desc: { en: 'PayPal & Stripe credentials for checkout and payouts', ht: 'Kle PayPal & Stripe pou acha ak peman' },
    keys: [
      'paypal_client_id', 'paypal_client_secret', 'paypal_webhook_id', 'paypal_mode',
      'stripe_secret_key', 'stripe_webhook_secret',
    ],
  },
  {
    key: 'notifications',
    icon: 'fa-bell',
    title: { en: 'Notifications', ht: 'Notifikasyon' },
    desc: { en: 'Firebase push notification credentials', ht: 'Kle notifikasyon Firebase' },
    keys: ['firebase_server_key', 'firebase_credentials_json', 'push_notifications_enabled'],
  },
  {
    key: 'firebase-web',
    icon: 'fa-fire',
    title: { en: 'Firebase Web Config', ht: 'Konfig Firebase Web' },
    desc: { en: 'Firebase web app config (public — from Firebase Console → Project Settings)', ht: 'Konfig aplikasyon web Firebase (piblik — soti nan Firebase Console → Paramèt Pwojè)' },
    keys: [
      'firebase_api_key', 'firebase_auth_domain', 'firebase_database_url',
      'firebase_project_id', 'firebase_storage_bucket', 'firebase_messaging_sender_id',
      'firebase_app_id', 'firebase_measurement_id', 'firebase_vapid_key',
    ],
  },
  {
    key: 'ai',
    icon: 'fa-robot',
    title: { en: 'AI & Monitoring', ht: 'AI & Siveyans' },
    desc: { en: 'Gemini API key and Sentry error monitoring', ht: 'Kle Gemini ak siveyans erè Sentry' },
    keys: ['gemini_api_key', 'ai_services_enabled', 'sentry_dsn'],
  },
  {
    key: 'auth',
    icon: 'fa-right-to-bracket',
    title: { en: 'Authentication', ht: 'Otantifikasyon' },
    desc: { en: 'Social sign-in providers (Google OAuth client id)', ht: 'Pwovizè koneksyon sosyal (Google OAuth kle kliyan)' },
    keys: ['google_client_id'],
  },
  {
    key: 'general',
    icon: 'fa-sliders',
    title: { en: 'General', ht: 'Jeneral' },
    desc: { en: 'Feature toggles and platform limits', ht: 'Toggles ak limit platfòm' },
    keys: [
      'signups_enabled', 'creator_apply_enabled', 'marketplace_enabled',
      'max_upload_mb', 'session_timeout_minutes', 'maintenance_message',
      'data_retention_days', 'rate_limit_global',
      'wallet_topup_min', 'wallet_topup_max',
    ],
  },
  {
    key: 'seo',
    icon: 'fa-magnifying-glass-chart',
    title: { en: 'SEO / Verification / Tracking', ht: 'SEO / Verifyasyon / Siveyans' },
    desc: { en: 'Paste Facebook/Google verification codes, analytics, or SDK snippets — injected into every page <head> automatically', ht: 'Kole kòd verifyasyon Facebook/Google, analytics, oswa snippet SDK — enjekte otomatikman nan <head> chak paj' },
    keys: [
      'custom_head_html', 'facebook_domain_verification', 'google_site_verification',
      'google_analytics_id', 'facebook_pixel_id',
    ],
  },
];

const VALUE_TYPES = ['str', 'int', 'float', 'bool', 'json'];

export default function AdminPlatformConfig({ lang = 'ht', showToast }) {
  const isHt = lang === 'ht';
  // Memoized so useCallback deps below (`handleSave`) stay stable.
  const t = useCallback((en, ht) => (isHt ? (ht || en) : en), [isHt]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({}); // key -> draft value
  const [revealed, setRevealed] = useState({}); // key -> show raw input
  const [savingKey, setSavingKey] = useState(null);
  const [testingKey, setTestingKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [descDraft, setDescDraft] = useState({}); // key -> description draft
  const [descEditingKey, setDescEditingKey] = useState(null);
  const [descSavingKey, setDescSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Add-key form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState({ key: '', value_type: 'str', value: '', description: '', is_secret: false });
  const [adding, setAdding] = useState(false);

  // ── Load config rows — fetch lives inside the effect (like other
  // data-fetching components), so no synchronous setState in effect body;
  // retry simply bumps reloadKey to re-run this effect. ──────────────
  useEffect(() => {
    let cancelled = false;
    adminPlatformConfigService.list()
      .then((resp) => {
        if (cancelled) {return;}
        const data = Array.isArray(resp?.data) ? resp.data : (resp?.data?.results || []);
        setRows(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) {return;}
        const status = err?.response?.status;
        setError(
          status === 403
            ? (isHt ? 'Aksè admin obligatwa.' : 'Admin access required.')
            : (isHt ? 'Pa t kapab chaje konfigirasyon an.' : 'Could not load config.'),
        );
      })
      .finally(() => {
        if (!cancelled) {setLoading(false);}
      });
    return () => { cancelled = true; };
  }, [reloadKey, isHt]);

  const rowByKey = useMemo(() => {
    const map = {};
    rows.forEach((r) => { map[r.key] = r; });
    return map;
  }, [rows]);

  // Rows whose key is not part of any CONFIG_GROUP (custom keys added
  // via the "Add Key" form) still need a home — they render in their
  // own "Other Keys" section at the bottom so they stay visible,
  // editable and deletable. Before, they were created in the DB but
  // never shown — which read as "adding keys doesn't work".
  const otherRows = useMemo(() => {
    const grouped = new Set(CONFIG_GROUPS.flatMap((g) => g.keys));
    return rows.filter((r) => !grouped.has(r.key));
  }, [rows]);

  const handleSave = useCallback(async (row) => {
    const value = (editing[row.key] ?? row.value ?? '').trim();
    // For secrets: empty + a previously set value means "clear" — keep as-is.
    setSavingKey(row.key);
    try {
      await adminPlatformConfigService.update(row.id, { value });
      showToast?.(
        t('✅ Config saved — takes effect immediately.', '✅ Konfigirasyon sove — efektiv toudennen.'),
        'check-circle',
      );
      // Drop the draft so the input re-syncs to the server value
      // (masked for secrets) and the Save button disables again.
      setEditing((e) => { const next = { ...e }; delete next[row.key]; return next; });
      setReloadKey((k) => k + 1);
    } catch (err) {
      const detail = err?.response?.data?.value?.[0]
        || err?.response?.data?.error
        || err?.response?.data?.detail
        || t('Could not save config.', 'Pa t kapab sove konfigirasyon an.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSavingKey(null);
    }
  }, [editing, showToast, t]);

  const handleAdd = useCallback(async () => {
    const key = addDraft.key.trim();
    if (!key) {
      showToast?.(t('Key name is required.', 'Non kle a obligatwa.'), 'circle-exclamation');
      return;
    }
    setAdding(true);
    try {
      await adminPlatformConfigService.create({
        key,
        value: addDraft.value ?? '',
        value_type: addDraft.value_type || 'str',
        description: addDraft.description || '',
        is_secret: !!addDraft.is_secret,
      });
      showToast?.(
        t(`✅ Key "${key}" saved.`, `✅ Kle "${key}" sove.`),
        'check-circle',
      );
      setAddDraft({ key: '', value_type: 'str', value: '', description: '', is_secret: false });
      setShowAddForm(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.response?.data?.key?.[0]
        || t('Could not add key.', 'Pa t kapab ajoute kle a.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setAdding(false);
    }
  }, [addDraft, showToast, t]);

  // Test a stored key against its provider (format + live check).
  const handleTest = useCallback(async (row) => {
    setTestingKey(row.key);
    try {
      const resp = await adminPlatformConfigService.test(row.id);
      const { ok, message } = resp?.data || {};
      showToast?.(
        message || (ok ? t('Key looks good.', 'Kle a sanble bon.') : t('Key check failed.', 'Tès kle a echwe.')),
        ok ? 'check-circle' : 'circle-exclamation',
      );
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.error
        || t('Could not run the key test.', 'Pa t kapab teste kle a.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setTestingKey(null);
    }
  }, [showToast, t]);

  // Delete a key (with confirmation).
  const handleDelete = useCallback(async (row) => {
    const label = KEY_LABELS[row.key];
    const display = label ? (isHt ? label.ht : label.en) : row.key;
    if (!window.confirm(
      t(
        `Delete key "${display}" permanently? This cannot be undone.`,
        `Efase kle "${display}" definitivman? Aksyon sa a pa ka ranvèse.`,
      ),
    )) { return; }
    setDeletingKey(row.key);
    try {
      await adminPlatformConfigService.remove(row.id);
      showToast?.(
        t(`✅ Key "${display}" deleted.`, `✅ Kle "${display}" efase.`),
        'check-circle',
      );
      setReloadKey((k) => k + 1);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.error
        || t('Could not delete the key.', 'Pa t kapab efase kle a.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setDeletingKey(null);
    }
  }, [showToast, t, isHt]);

  // Save an edited description (PATCH description only).
  const handleSaveDescription = useCallback(async (row) => {
    const desc = (descDraft[row.key] ?? row.description ?? '').trim();
    setDescSavingKey(row.key);
    try {
      await adminPlatformConfigService.update(row.id, { description: desc });
      showToast?.(
        t('✅ Description saved.', '✅ Deskripsyon sove.'),
        'check-circle',
      );
      setDescDraft((d) => { const next = { ...d }; delete next[row.key]; return next; });
      setDescEditingKey(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.error
        || t('Could not save the description.', 'Pa t kapab sove deskripsyon an.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setDescSavingKey(null);
    }
  }, [descDraft, showToast, t]);

  const renderRow = (row) => {
    const label = KEY_LABELS[row.key];
    const isBool = row.value_type === 'bool';
    const isSecret = !!row.is_secret;
    const currentVal = row.value ?? '';
    const draft = editing[row.key] ?? currentVal;
    const unchanged = draft === String(currentVal ?? '');

    const editingDesc = descEditingKey === row.key;
    const descDraftValue = descDraft[row.key] ?? row.description ?? '';

    return (
      <div key={row.key} className="ad-cfg-row">
        <div className="ad-cfg-info">
          <div className="ad-cfg-label">
            {label ? (isHt ? label.ht : label.en) : row.key}
            {isSecret && <span className="ad-cfg-secret-badge" title="Secret — never shown in full"><i className="fas fa-lock" aria-hidden="true" /> secret</span>}
          </div>
          <div className="ad-cfg-key">
            <code>{row.key}</code> · {row.value_type}
            {!editingDesc && (
              <>
                {row.description
                  ? <span className="ad-cfg-desc"> — {row.description}</span>
                  : <span className="ad-cfg-desc ad-cfg-desc-empty">{t('No description', 'Pa gen deskripsyon')}</span>}
                <button
                  type="button"
                  className="ad-cfg-desc-edit"
                  onClick={() => { setDescDraft((d) => ({ ...d, [row.key]: row.description ?? '' })); setDescEditingKey(row.key); }}
                  title={t('Edit description', 'Modifye deskripsyon')}
                  aria-label={t('Edit description', 'Modifye deskripsyon')}
                >
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
              </>
            )}
            {editingDesc && (
              <span className="ad-cfg-desc-edit-wrap">
                <input
                  className="ad-cfg-desc-input"
                  value={descDraftValue}
                  onChange={(e) => setDescDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                  placeholder={t('What is this key used for?', 'Kisa kle sa a sèvi pou?')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleSaveDescription(row); }
                    if (e.key === 'Escape') { setDescEditingKey(null); }
                  }}
                />
                <button
                  type="button"
                  className="ad-cfg-desc-edit"
                  onClick={() => handleSaveDescription(row)}
                  disabled={descSavingKey === row.key}
                  title={t('Save description', 'Sove deskripsyon')}
                  aria-label={t('Save description', 'Sove deskripsyon')}
                >
                  {descSavingKey === row.key
                    ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    : <i className="fas fa-check" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="ad-cfg-desc-edit"
                  onClick={() => { setDescEditingKey(null); setDescDraft((d) => { const next = { ...d }; delete next[row.key]; return next; }); }}
                  title={t('Cancel', 'Anile')}
                  aria-label={t('Cancel', 'Anile')}
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="ad-cfg-controls">
          {isBool ? (
            <label className="ad-cfg-bool">
              <input
                type="checkbox"
                checked={draft === 'true'}
                onChange={(e) => setEditing((prev) => ({ ...prev, [row.key]: e.target.checked ? 'true' : 'false' }))}
              />
              <span>{draft === 'true' ? (isHt ? 'Aktive' : 'Enabled') : (isHt ? 'Fèmen' : 'Disabled')}</span>
            </label>
          ) : MULTILINE_KEYS.has(row.key) ? (
            <textarea
              className="ad-cfg-input ad-cfg-textarea"
              rows={6}
              value={draft}
              onChange={(e) => setEditing((prev) => ({ ...prev, [row.key]: e.target.value }))}
              aria-label={label ? (isHt ? label.ht : label.en) : row.key}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('Paste HTML / <script> snippets here…', 'Kole HTML / <script> snippets isit la…')}
            />
          ) : (
            <>
              <input
                className="ad-cfg-input"
                type={isSecret && !revealed[row.key] ? 'password' : 'text'}
                value={draft}
                onChange={(e) => setEditing((prev) => ({ ...prev, [row.key]: e.target.value }))}
                placeholder={isSecret && !currentVal ? '••••••••' : undefined}
                aria-label={label ? (isHt ? label.ht : label.en) : row.key}
                autoComplete="off"
                spellCheck={false}
              />
              {isSecret && (
                <button
                  type="button"
                  className="ad-cfg-eye"
                  onClick={() => setRevealed((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                  title={revealed[row.key]
                    ? t('Hide value', 'Kache valè a')
                    : t('Show value (still masked)', 'Montre valè a (toujou maske)')}
                  aria-label={revealed[row.key] ? 'Hide value' : 'Show value'}
                >
                  <i className={`fas ${revealed[row.key] ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="ad-dash-panel-action-btn"
            onClick={() => handleSave(row)}
            disabled={savingKey === row.key || unchanged}
          >
            {savingKey === row.key ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Saving...', 'Ap sove...')}</>
            ) : (
              <><i className="fas fa-save" aria-hidden="true" /> {t('Save', 'Sove')}</>
            )}
          </button>
          <button
            type="button"
            className="ad-dash-panel-action-btn ad-cfg-btn-test"
            onClick={() => handleTest(row)}
            disabled={testingKey === row.key || deletingKey === row.key}
            title={t('Test this key against its provider', 'Teste kle sa a ak founisè li')}
          >
            {testingKey === row.key ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Testing...', 'Ap teste...')}</>
            ) : (
              <><i className="fas fa-flask" aria-hidden="true" /> {t('Test', 'Teste')}</>
            )}
          </button>
          <button
            type="button"
            className="ad-dash-panel-action-btn ad-cfg-btn-delete"
            onClick={() => handleDelete(row)}
            disabled={deletingKey === row.key || testingKey === row.key}
            title={t('Delete key', 'Efase kle')}
            aria-label={t('Delete key', 'Efase kle')}
          >
            {deletingKey === row.key ? (
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fas fa-trash-alt" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="ad-dash-panel">
      <div className="ad-dash-panel-header">
        <h2 className="ad-dash-panel-title">
          <i className="fas fa-key" aria-hidden="true" />
          {' '}{t('API Keys & Platform Config', 'Kle API & Konfigirasyon')}
        </h2>
        <span className="ad-dash-panel-badge">
          {t('Runtime — no redeploy', 'Efektiv — pa bezwen redeploy')}
        </span>
        <button
          type="button"
          className="ad-dash-panel-action-btn"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <i className={`fas ${showAddForm ? 'fa-minus' : 'fa-plus'}`} aria-hidden="true" />
          {' '}{t(showAddForm ? 'Close' : 'Add Key', showAddForm ? 'Fèmen' : 'Ajoute Kle')}
        </button>
      </div>

      <div className="ad-dash-panel-body">
        {/* ── Add-new-key form — always available, even while the list
             loads or errors: adding a key must never be blocked by a
             transient list failure. ────────────────────────────── */}
        {showAddForm && (
          <div className="ad-cfg-add-form">
            <div className="ad-cfg-add-title">
              <i className="fas fa-plus-circle" aria-hidden="true" />
              {' '}{t('Add a new API key / config', 'Ajoute yon nouvo kle API / konfigirasyon')}
            </div>
            <div className="ad-cfg-add-grid">
              <label className="ad-cfg-add-field">
                <span>{t('Key name', 'Non kle')}</span>
                <input
                  value={addDraft.key}
                  onChange={(e) => setAddDraft((d) => ({ ...d, key: e.target.value }))}
                  placeholder="e.g. openai_api_key"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="ad-cfg-add-field">
                <span>{t('Type', 'Kalite')}</span>
                <select
                  value={addDraft.value_type}
                  onChange={(e) => setAddDraft((d) => ({ ...d, value_type: e.target.value }))}
                >
                  {VALUE_TYPES.map((vt) => <option key={vt} value={vt}>{vt}</option>)}
                </select>
              </label>
              <label className="ad-cfg-add-field ad-cfg-add-field-wide">
                <span>{t('Value', 'Valè')}</span>
                <input
                  type={addDraft.is_secret ? 'password' : 'text'}
                  value={addDraft.value}
                  onChange={(e) => setAddDraft((d) => ({ ...d, value: e.target.value }))}
                  placeholder={t('The key value / secret', 'Valè kle a / sekrè a')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="ad-cfg-add-field ad-cfg-add-field-wide">
                <span>{t('Description', 'Deskripsyon')}</span>
                <input
                  value={addDraft.description}
                  onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder={t('What is this key used for?', 'Kisa kle sa a sèvi pou?')}
                />
              </label>
              <label className="ad-cfg-add-field ad-cfg-add-check">
                <input
                  type="checkbox"
                  checked={addDraft.is_secret}
                  onChange={(e) => setAddDraft((d) => ({ ...d, is_secret: e.target.checked }))}
                />
                <span>{t('Secret (never shown in full)', 'Sekrè (poko montre konplè)')}</span>
              </label>
              <div className="ad-cfg-add-actions">
                <button
                  type="button"
                  className="ad-dash-panel-action-btn"
                  onClick={handleAdd}
                  disabled={adding}
                >
                  {adding ? (
                    <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Adding...', 'Ap ajoute...')}</>
                  ) : (
                    <><i className="fas fa-plus" aria-hidden="true" /> {t('Add Key', 'Ajoute Kle')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="ad-dash-panel-loading">
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="ad-dash-error-banner">
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)}>{t('Retry', 'Eseye ankò')}</button>
          </div>
        ) : (
          <>
            {/* ── Grouped config rows ──────────────────────────── */}
            {CONFIG_GROUPS.map((group) => {
              const groupRows = rows.filter((r) => group.keys.includes(r.key));
              const missing = group.keys.filter((k) => !rowByKey[k]);
              if (groupRows.length === 0 && missing.length === 0) {return null;}
              return (
                <div key={group.key} className="ad-cfg-group">
                  <div className="ad-cfg-group-head">
                    <span className="ad-cfg-group-title">
                      <i className={`fas ${group.icon}`} aria-hidden="true" />
                      {' '}{isHt ? group.title.ht : group.title.en}
                    </span>
                    <span className="ad-cfg-group-desc">
                      {isHt ? group.desc.ht : group.desc.en}
                    </span>
                  </div>
                  {missing.length > 0 && (
                    <p className="ad-cfg-hint">
                      {t('Defaults / env in effect for:', 'Valè defo / env ap itilize pou:')}{' '}
                      {missing.join(', ')}
                    </p>
                  )}
                  <div className="ad-cfg-list">
                    {groupRows.map(renderRow)}
                  </div>
                </div>
              );
            })}

            {/* ── Other / custom keys (not in any config group) ── */}
            {otherRows.length > 0 && (
              <div className="ad-cfg-group">
                <div className="ad-cfg-group-head">
                  <span className="ad-cfg-group-title">
                    <i className="fas fa-plus-circle" aria-hidden="true" />
                    {' '}{t('Other Keys', 'Lòt Kle')}
                  </span>
                  <span className="ad-cfg-group-desc">
                    {t('Custom keys added by admins', 'Kle koutim admin yo te ajoute')}
                  </span>
                </div>
                <div className="ad-cfg-list">
                  {otherRows.map(renderRow)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
