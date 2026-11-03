/**
 * src/components/studio/sections/AffiliateSection.jsx
 *
 * Creator Studio — Affiliate Program Management.
 *
 * Sub-tabs:
 *   1. Overview   — aggregate stats (affiliates, sales, commissions)
 *   2. Settings   — toggle program, approval mode, commission percentages
 *   3. Members    — active affiliates ranked by earnings
 *   4. Applications — pending applications (approve / reject)
 *   5. Groups     — commission tiers (VIP, Normal, custom)
 *   6. Rules      — product / category commission rules
 */
import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { affiliateApi } from '../../../services/affiliateApi';
import useFetch from '../../../hooks/useFetch';
import { t as t4 } from '../../../utils/i18n';
import { StudioSkeleton, EmptyState, SectionHeader, fmtCurrency, fmtCount, fmtDate, classNames } from '../shared';
import styles from './sections.module.css';

const CampaignDetail = lazy(() => import('../../CampaignDetail'));

const SUB_TABS = [
  { id: 'overview',     icon: 'fa-chart-pie',      label: 'Overview',     labelHt: 'Apèsi', labelFr: 'Aperçu', labelEs: 'Resumen' },
  { id: 'settings',     icon: 'fa-cog',             label: 'Settings',     labelHt: 'Anviwònman', labelFr: 'Paramètres', labelEs: 'Ajustes' },
  { id: 'members',      icon: 'fa-users',           label: 'Members',      labelHt: 'Manb', labelFr: 'Membres', labelEs: 'Miembros' },
  { id: 'applications', icon: 'fa-file-alt',        label: 'Applications', labelHt: 'Aplikasyon', labelFr: 'Candidatures', labelEs: 'Solicitudes' },
  { id: 'conversions',  icon: 'fa-shopping-cart',   label: 'Conversions',  labelHt: 'Konvèsyon', labelFr: 'Conversions', labelEs: 'Conversiones' },
  { id: 'groups',       icon: 'fa-layer-group',     label: 'Groups',       labelHt: 'Gwoup', labelFr: 'Groupes', labelEs: 'Grupos' },
  { id: 'rules',        icon: 'fa-balance-scale',   label: 'Commission Rules', labelHt: 'Règ Komisyon', labelFr: 'Règles de commission', labelEs: 'Reglas de comisión' },
  { id: 'campaigns',    icon: 'fa-bullhorn',        label: 'Campaigns',   labelHt: 'Kanpay', labelFr: 'Campagnes', labelEs: 'Campañas' },
  { id: 'intelligence', icon: 'fa-robot',           label: 'AI Insights', labelHt: 'AI Insights', labelFr: 'AI Insights', labelEs: 'AI Insights' },
  { id: 'wizard',       icon: 'fa-wand-magic',      label: 'Campaign Wizard', labelHt: 'Gid Kanpay', labelFr: 'Assistant campagne', labelEs: 'Asistente de campaña' },
  { id: 'budget',       icon: 'fa-calculator',       label: 'Budget & Score', labelHt: 'Bidjè & Skò', labelFr: 'Budget et score', labelEs: 'Presupuesto y puntuación' },
  { id: 'ai-assist',    icon: 'fa-brain',      label: 'AI Optimize',    labelHt: 'AI Optimize', labelFr: 'AI Optimize', labelEs: 'AI Optimize' },
];

function pickLabel(item, lang) {
  if (lang === 'ht') return item.labelHt || item.label;
  if (lang === 'fr') return item.labelFr || item.label;
  if (lang === 'es') return item.labelEs || item.label;
  return item.label;
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════

function OverviewTab({ lang, t, showToast }) {
  const { data: program, loading: progLoading } = useFetch(
    () => affiliateApi.getProgram(),
    { defaultValue: null, deps: [] },
  );
  const { data: stats, loading: statsLoading } = useFetch(
    () => affiliateApi.getStats(),
    { defaultValue: null, deps: [] },
  );

  if (progLoading || statsLoading) return <StudioSkeleton rows={4} />;

  const isActive = program?.is_active;

  return (
    <div className={styles.section}>
      {/* Status banner */}
      <div className={`${styles.affiliateBanner} ${isActive ? styles.affiliateBannerActive : styles.affiliateBannerInactive}`}>
        <i className={`fas ${isActive ? 'fa-check-circle' : 'fa-pause-circle'}`} aria-hidden="true" />
        <span>
          {isActive
            ? (t4(lang, "Pwogram afilyasyon aktive", "Affiliate program active", "Programme d'affiliation actif", "Programa de afiliación activo"))
            : (t4(lang, "Pwogram afilyasyon dezaktive", "Affiliate program inactive", "Programme d'affiliation inactif", "Programa de afiliación inactivo"))}
        </span>
      </div>

      {/* Stats grid */}
      <div className={styles.affiliateGrid}>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{fmtCount(stats?.total_affiliates || 0)}</div>
          <div className={styles.affiliateStatLabel}>{t4(lang, "Total Afilye", "Total Affiliates", "Total affiliés", "Total afiliados")}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{fmtCount(stats?.active_affiliates || 0)}</div>
          <div className={styles.affiliateStatLabel}>{t4(lang, "Aktif", "Active", "Actif", "Activo")}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{fmtCurrency(stats?.total_sales_generated || 0)}</div>
          <div className={styles.affiliateStatLabel}>{t4(lang, "Vant Jenere", "Sales Generated", "Ventes générées", "Ventas generadas")}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{fmtCurrency(stats?.total_commission_paid || 0)}</div>
          <div className={styles.affiliateStatLabel}>{t4(lang, "Komisyon Peye", "Commission Paid", "Commissions payées", "Comisiones pagadas")}</div>
        </div>
      </div>

      {/* Top affiliates */}
      {stats?.top_affiliates?.length > 0 && (
        <>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-crown" aria-hidden="true" />
            {t4(lang, "Pi bon Afilye", "Top Affiliates", "Meilleurs affiliés", "Mejores afiliados")}
          </h3>
          <div className={styles.list}>
            {stats.top_affiliates.map((a, i) => (
              <div key={a.id} className={styles.listItem}>
                <div className={styles.listBody}>
                  <span className={styles.listTitle}>
                    {i + 1}. {a.username}
                  </span>
                  <span className={styles.listMeta}>
                    {fmtCount(a.total_conversions)} {t4(lang, "konvèsyon", "conversions", "conversions", "conversiones")} · Nivo: {a.level}
                  </span>
                </div>
                <div className={styles.affiliateEarned}>{fmtCurrency(a.total_earned)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {stats?.pending_applications > 0 && (
        <div className={styles.affiliateNotice}>
          <i className="fas fa-bell" aria-hidden="true" />
          <span>
            {stats.pending_applications} {t4(lang, "aplikasyon annatant revizyon", "applications pending review", "candidatures en attente de révision", "solicitudes pendientes de revisión")}
          </span>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ lang, t, showToast }) {
  const { data: program, loading, refetch } = useFetch(
    () => affiliateApi.getProgram(),
    { defaultValue: null, deps: [] },
  );
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (program && !form) {
      setForm({
        is_active: program.is_active || false,
        approval_mode: program.approval_mode || 'manual',
        default_commission_pct: program.default_commission_pct || 10,
        vip_commission_pct: program.vip_commission_pct || 25,
        max_affiliates: program.max_affiliates || 0,
        min_account_age_days: program.min_account_age_days || 0,
      });
    }
  }, [program, form]);

  const handleToggle = useCallback(async () => {
    try {
      const res = await affiliateApi.toggleProgram();
      showToast?.(res?.data?.message || 'Toggled', 'check');
      refetch();
      setForm(null);
    } catch {
      showToast?.('Failed to toggle', 'error');
    }
  }, [showToast, refetch]);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    try {
      await affiliateApi.updateProgram(form);
      showToast?.('Settings saved', 'check');
      refetch();
    } catch {
      showToast?.('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, showToast, refetch]);

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      {/* Toggle */}
      <div className={styles.affiliateToggleRow}>
        <div>
          <strong>{t4(lang, "Pwogram Afilyasyon", "Affiliate Program", "Programme d'affiliation", "Programa de afiliación")}</strong>
          <p className={styles.affiliateToggleDesc}>
            {t4(lang, "Pèmèt itilizatè yo vin afilye ak pwogram ou an", "Allow users to become affiliates of your program", "Permettez aux utilisateurs de devenir affiliés à votre programme", "Permite que los usuarios se conviertan en afiliados de tu programa")}
          </p>
        </div>
        <label className={styles.affiliateSwitch}>
          <input
            type="checkbox"
            checked={form?.is_active || false}
            onChange={handleToggle}
          />
          <span className={styles.affiliateSwitchSlider} />
        </label>
      </div>

      {form && (
        <div className={styles.affiliateForm}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Mòd Apwobasyon", "Approval Mode", "Mode d'approbation", "Modo de aprobación")}</label>
            <select
              value={form.approval_mode}
              onChange={(e) => setForm({ ...form, approval_mode: e.target.value })}
              className={styles.formSelect}
            >
              <option value="manual">{t4(lang, "Manyèl", "Manual", "Manuel", "Manual")}</option>
              <option value="automatic">{t4(lang, "Otomatik", "Automatic", "Automatique", "Automático")}</option>
              <option value="invite_only">{t4(lang, "Sèlman envite", "Invite Only", "Sur invitation uniquement", "Solo por invitación")}</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon Defo (%)", "Default Commission (%)", "Commission par défaut (%)", "Comisión predeterminada (%)")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.default_commission_pct}
              onChange={(e) => setForm({ ...form, default_commission_pct: parseFloat(e.target.value) || 0 })}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon VIP (%)", "VIP Commission (%)", "Commission VIP (%)", "Comisión VIP (%)")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.vip_commission_pct}
              onChange={(e) => setForm({ ...form, vip_commission_pct: parseFloat(e.target.value) || 0 })}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t4(lang, "Maksimòm Afilye", "Max Affiliates", "Max. affiliés", "Máx. afiliados")}</label>
            <input
              type="number"
              min="0"
              value={form.max_affiliates}
              onChange={(e) => setForm({ ...form, max_affiliates: parseInt(e.target.value, 10) || 0 })}
              className={styles.formInput}
            />
            <small className={styles.formHint}>{t4(lang, "0 = san limit", "0 = unlimited", "0 = illimité", "0 = ilimitado")}</small>
          </div>

          <div className={styles.formGroup}>
            <label>{t4(lang, "Laj Minimòm Kont (jou)", "Min Account Age (days)", "Âge min. du compte (jours)", "Antigüedad mín. de cuenta (días)")}</label>
            <input
              type="number"
              min="0"
              value={form.min_account_age_days}
              onChange={(e) => setForm({ ...form, min_account_age_days: parseInt(e.target.value, 10) || 0 })}
              className={styles.formInput}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t4(lang, "Anrejistre...", "Saving...", "Enregistrement...", "Guardando...")}</>
            ) : (
              <><i className="fas fa-save" aria-hidden="true" /> {t4(lang, "Anrejistre", "Save Settings", "Enregistrer", "Guardar ajustes")}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function MembersTab({ lang, t, showToast }) {
  const { data: members, loading, refetch } = useFetch(
    () => affiliateApi.getMembers(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      {members.length === 0 ? (
        <EmptyState
          icon="fa-users"
          title={t4(lang, "Pokò gen afilye", "No affiliates yet", "Aucun affilié pour le moment", "Aún no hay afiliados")}
          hint={t4(lang, "Lè itilizatè yo vin afilye, yo parèt isit", "When users become affiliates, they appear here", "Lorsque des utilisateurs deviennent affiliés, ils apparaissent ici", "Cuando los usuarios se convierten en afiliados, aparecen aquí")}
        />
      ) : (
        <div className={styles.list}>
          {members.map((m) => (
            <div key={m.id} className={styles.listItem}>
              <div className={styles.listAvatar}>
                {m.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{m.username}</div>
                <div className={styles.listMeta}>
                  {fmtCount(m.total_clicks)} {t4(lang, "klik", "clicks", "clics", "clics")} ·
                  {fmtCount(m.total_conversions)} {t4(lang, "konvèsyon", "conversions", "conversions", "conversiones")} ·
                  {t4(lang, "Nivo", "Level", "Niveau", "Nivel")}: {m.level} ·
                  {t4(lang, "Konfyans", "Trust", "Confiance", "Confianza")}: {m.trust_score}/100
                </div>
              </div>
              <div className={styles.affiliateEarned}>{fmtCurrency(m.total_earned)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab({ lang, t, showToast }) {
  const { data: apps, loading, refetch } = useFetch(
    () => affiliateApi.getApplications('pending'),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleReview = useCallback(async (id, status) => {
    try {
      await affiliateApi.reviewApplication(id, status);
      showToast?.(`Application ${status}`, 'check');
      refetch();
    } catch {
      showToast?.(`Failed to ${status} application`, 'error');
    }
  }, [showToast, refetch]);

  if (loading) return <StudioSkeleton rows={3} />;

  return (
    <div className={styles.section}>
      {apps.length === 0 ? (
        <EmptyState
          icon="fa-file-alt"
          title={t4(lang, "Pa gen aplikasyon annatant", "No pending applications", "Aucune candidature en attente", "No hay solicitudes pendientes")}
          hint={t4(lang, "Yo parèt isit lè yon itilizatè aplike", "They appear here when someone applies", "Ils apparaissent ici lorsqu'un utilisateur postule", "Aparecen aquí cuando alguien aplica")}
        />
      ) : (
        <div className={styles.list}>
          {apps.map((app) => (
            <div key={app.id} className={styles.listItem}>
              <div className={styles.listAvatar}>
                {app.applicant_username?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{app.applicant_username}</div>
                <div className={styles.listMeta}>
                  {fmtDate(app.created_at)}
                  {app.motivation && <> · <em>"{app.motivation}"</em></>}
                </div>
              </div>
              <div className={styles.listActions}>
                <button
                  type="button"
                  className={styles.affiliateBtnApprove}
                  onClick={() => handleReview(app.id, 'approved')}
                  title={t4(lang, "Apwouve", "Approve", "Approuver", "Aprobar")}
                >
                  <i className="fas fa-check" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.affiliateBtnReject}
                  onClick={() => handleReview(app.id, 'rejected')}
                  title={t4(lang, "Refize", "Reject", "Rejeter", "Rechazar")}
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversionsTab({ lang, t, showToast }) {
  const { data: conversions, loading, refetch } = useFetch(
    () => affiliateApi.getConversations(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleApprove = useCallback(async (id) => {
    try {
      await affiliateApi.approveConversion(id);
      showToast?.('Conversion approved', 'check');
      refetch();
    } catch {
      showToast?.('Failed to approve', 'error');
    }
  }, [showToast, refetch]);

  const handleReverse = useCallback(async (id) => {
    try {
      await affiliateApi.reverseConversion(id);
      showToast?.('Conversion reversed', 'check');
      refetch();
    } catch {
      showToast?.('Failed to reverse', 'error');
    }
  }, [showToast, refetch]);

  if (loading) return <StudioSkeleton rows={4} />;

  const statusBadge = (status) => {
    const map = {
      pending: { bg: '#f59e0b', label: t4(lang, "Annatant", "Pending", "En attente", "Pendiente") },
      approved: { bg: '#10b981', label: t4(lang, "Apwouve", "Approved", "Approuvé", "Aprobado") },
      reversed: { bg: '#ef4444', label: t4(lang, "Anile", "Reversed", "Annulée", "Revertida") },
      disputed: { bg: '#8b5cf6', label: t4(lang, "Diskite", "Disputed", "Contestée", "Disputada") },
    };
    const s = map[status] || map.pending;
    return <span className={styles.badge} style={{ background: s.bg, color: '#fff' }}>{s.label}</span>;
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-shopping-cart" aria-hidden="true" />
        {t4(lang, "Konvèsyon", "Conversions", "Conversions", "Conversiones")}
      </h3>

      {conversions.length === 0 ? (
        <EmptyState
          icon="fa-shopping-cart"
          title={t4(lang, "Pokò gen konvèsyon", "No conversions yet", "Aucune conversion pour le moment", "Aún no hay conversiones")}
          hint={t4(lang, "Konvèsyon yo parèt isit lè yon afilye fè yon achte", "Conversions appear here when an affiliate makes a sale", "Les conversions apparaissent ici lorsqu'un affilié réalise une vente", "Las conversiones aparecen aquí cuando un afiliado genera una venta")}
        />
      ) : (
        <div className={styles.list}>
          {conversions.map((c) => (
            <div key={c.id} className={styles.listItem}>
              <div className={styles.listAvatar}>
                <i className="fas fa-shopping-cart" aria-hidden="true" />
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {c.affiliate_username || 'Unknown Affiliate'}
                </div>
                <div className={styles.listMeta}>
                  {fmtCurrency(c.sale_amount)} · {c.commission_pct}% · {fmtDate(c.created_at)}
                  {c.link_code && <> · {c.link_code}</>}
                </div>
              </div>
              <div className={styles.listActions}>
                {statusBadge(c.status)}
                {c.status === 'pending' && (
                  <button type="button" className={styles.affiliateBtnApprove}
                    onClick={() => handleApprove(c.id)}
                    title={t4(lang, "Apwouve", "Approve", "Approuver", "Aprobar")}>
                    <i className="fas fa-check" aria-hidden="true" />
                  </button>
                )}
                {c.status === 'approved' && (
                  <button type="button" className={styles.affiliateBtnReject}
                    onClick={() => handleReverse(c.id)}
                    title={t4(lang, "Anile", "Reverse", "Annuler", "Revertir")}>
                    <i className="fas fa-undo" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsTab({ lang, t, showToast }) {
  const { data: groups, loading, refetch } = useFetch(
    () => affiliateApi.getGroups(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', commission_pct: 10, description: '', max_members: 0 });

  const handleCreate = useCallback(async () => {
    if (!form.name) return;
    try {
      await affiliateApi.createGroup(form);
      showToast?.('Group created', 'check');
      setShowForm(false);
      setForm({ name: '', commission_pct: 10, description: '', max_members: 0 });
      refetch();
    } catch {
      showToast?.('Failed to create group', 'error');
    }
  }, [form, showToast, refetch]);

  if (loading) return <StudioSkeleton rows={2} />;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-layer-group" aria-hidden="true" />
          {t4(lang, "Gwoup Afilyasyon", "Affiliate Groups", "Groupes d'affiliation", "Grupos de afiliación")}
        </h3>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowForm(!showForm)}
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {t4(lang, "Nouvo Gwoup", "New Group", "Nouveau groupe", "Nuevo grupo")}
        </button>
      </div>

      {showForm && (
        <div className={styles.affiliateForm}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Non Gwoup", "Group Name", "Nom du groupe", "Nombre del grupo")}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={styles.formInput}
              placeholder={t4(lang, "Eg: VIP, An komen", "e.g. VIP, Basic", "Ex : VIP, Basique", "Ej.: VIP, Básico")}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon (%)", "Commission (%)", "Commission (%)", "Comisión (%)")}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.commission_pct}
              onChange={(e) => setForm({ ...form, commission_pct: parseFloat(e.target.value) || 0 })}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Deskripsyon", "Description", "Description", "Descripción")}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={styles.formInput}
              rows={2}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreate}
          >
            <i className="fas fa-save" aria-hidden="true" />
            {t4(lang, "Kreye Gwoup", "Create Group", "Créer un groupe", "Crear grupo")}
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon="fa-layer-group"
          title={t4(lang, "Pokò gen gwoup", "No groups yet", "Aucun groupe pour le moment", "Aún no hay grupos")}
        />
      ) : (
        <div className={styles.list}>
          {groups.map((g) => (
            <div key={g.id} className={styles.listItem}>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{g.name}</div>
                <div className={styles.listMeta}>
                  {g.description && <>{g.description} · </>}
                  {fmtCount(g.member_count || 0)} {t4(lang, "manb", "members", "membres", "miembros")} ·
                  {g.is_active ? (t4(lang, "Aktif", "Active", "Actif", "Activo")) : (t4(lang, "Inaktif", "Inactive", "Inactif", "Inactivo"))}
                </div>
              </div>
              <div className={styles.affiliateEarned}>{g.commission_pct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesTab({ lang, t, showToast }) {
  const { data: rules, loading, refetch } = useFetch(
    () => affiliateApi.getCommissionRules(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ scope: 'product', scope_value: '', commission_pct: 10 });

  const handleCreate = useCallback(async () => {
    if (!form.scope_value) return;
    try {
      await affiliateApi.createCommissionRule(form);
      showToast?.('Commission rule created', 'check');
      setShowForm(false);
      setForm({ scope: 'product', scope_value: '', commission_pct: 10 });
      refetch();
    } catch {
      showToast?.('Failed to create rule', 'error');
    }
  }, [form, showToast, refetch]);

  if (loading) return <StudioSkeleton rows={2} />;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-balance-scale" aria-hidden="true" />
          {t4(lang, "Règ Komisyon", "Commission Rules", "Règles de commission", "Reglas de comisión")}
        </h3>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowForm(!showForm)}
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {t4(lang, "Nouvo Règ", "New Rule", "Nouvelle règle", "Nueva regla")}
        </button>
      </div>

      {showForm && (
        <div className={styles.affiliateForm}>
          <div className={styles.formGroup}>
            <label>{t4(lang, " Kalite", "Scope", "Portée", "Alcance")}</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className={styles.formSelect}
            >
              <option value="product">{t4(lang, "Pwodwi", "Product", "Produit", "Producto")}</option>
              <option value="category">{t4(lang, "Kategori", "Category", "Catégorie", "Categoría")}</option>
              <option value="program">{t4(lang, "Pwogram", "Program", "Programme", "Programa")}</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Valè (ID pwodwi oswa non kategori)", "Value (Product ID or Category Name)", "Valeur (ID produit ou nom de catégorie)", "Valor (ID de producto o nombre de categoría)")}</label>
            <input
              type="text"
              value={form.scope_value}
              onChange={(e) => setForm({ ...form, scope_value: e.target.value })}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon (%)", "Commission (%)", "Commission (%)", "Comisión (%)")}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.commission_pct}
              onChange={(e) => setForm({ ...form, commission_pct: parseFloat(e.target.value) || 0 })}
              className={styles.formInput}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreate}
          >
            <i className="fas fa-save" aria-hidden="true" />
            {t4(lang, "Kreye Règ", "Create Rule", "Créer une règle", "Crear regla")}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon="fa-balance-scale"
          title={t4(lang, "Pokò gen règ komisyon", "No commission rules yet", "Aucune règle de commission pour le moment", "Aún no hay reglas de comisión")}
          hint={t4(lang, "Règ pèmèt ou pèsonalize komisyon pou pwodwi oswa kategori espesifik", "Rules let you customize commissions for specific products or categories", "Les règles permettent de personnaliser les commissions pour des produits ou catégories spécifiques", "Las reglas permiten personalizar las comisiones para productos o categorías específicos")}
        />
      ) : (
        <div className={styles.list}>
          {rules.map((r) => (
            <div key={r.id} className={styles.listItem}>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {r.scope}: {r.scope_value}
                </div>
                <div className={styles.listMeta}>
                  {r.is_active ? (t4(lang, "Aktif", "Active", "Actif", "Activo")) : (t4(lang, "Inaktif", "Inactive", "Inactif", "Inactivo"))}
                  {r.starts_at && <> · {t4(lang, "Kòmanse", "Starts", "Début", "Inicio")}: {fmtDate(r.starts_at)}</>}
                  {r.ends_at && <> · {t4(lang, "Fini", "Ends", "Fin", "Fin")}: {fmtDate(r.ends_at)}</>}
                </div>
              </div>
              <div className={styles.affiliateEarned}>{r.commission_pct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Campaigns Tab
// ═══════════════════════════════════════════════════════════════════════

function CampaignsTab({ lang, t, showToast }) {
  const { data: campaigns, loading, refetch } = useFetch(
    () => affiliateApi.getCampaigns(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', start_date: '', end_date: '',
    commission_pct: 15, target_audience: '', featured_product_ids: [],
  });

  const handleAction = useCallback(async (id, action) => {
    try {
      const actionMap = {
        activate: affiliateApi.activateCampaign,
        pause: affiliateApi.pauseCampaign,
        end: affiliateApi.endCampaign,
      };
      await actionMap[action](id);
      showToast?.(`Campaign ${action}d`, 'check');
      refetch();
    } catch {
      showToast?.(`Failed to ${action} campaign`, 'error');
    }
  }, [showToast, refetch]);

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.start_date) return;
    try {
      await affiliateApi.createCampaign({
        ...form,
        start_date: new Date(form.start_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      });
      showToast?.('Campaign created', 'check');
      setShowForm(false);
      setForm({ name: '', description: '', start_date: '', end_date: '',
               commission_pct: 15, target_audience: '', featured_product_ids: [] });
      refetch();
    } catch {
      showToast?.('Failed to create campaign', 'error');
    }
  }, [form, showToast, refetch]);

  if (selectedId) {
    return (
      <Suspense fallback={<StudioSkeleton rows={6} />}>
        <CampaignDetail
          campaignId={selectedId}
          lang={lang}
          t={t}
          showToast={showToast}
          onBack={() => setSelectedId(null)}
        />
      </Suspense>
    );
  }

  if (loading) return <StudioSkeleton rows={3} />;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-bullhorn" aria-hidden="true" />
          {t4(lang, "Kanpay", "Campaigns", "Campagnes", "Campañas")}
        </h3>
        <button type="button" className="btn-secondary" onClick={() => setShowForm(!showForm)}>
          <i className="fas fa-plus" aria-hidden="true" />
          {t4(lang, "Nouvo Kanpay", "New Campaign", "Nouvelle campagne", "Nueva campaña")}
        </button>
      </div>

      {showForm && (
        <div className={styles.affiliateForm}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Non", "Name", "Nom", "Nombre")}</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
              className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Deskripsyon", "Description", "Description", "Descripción")}</label>
            <textarea value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
              className={styles.formInput} rows={2} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{t4(lang, "Dat Kòmanse", "Start Date", "Date de début", "Fecha de inicio")}</label>
              <input type="date" value={form.start_date}
                onChange={(e) => setForm({...form, start_date: e.target.value})}
                className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label>{t4(lang, "Dat Fini", "End Date", "Date de fin", "Fecha de fin")}</label>
              <input type="date" value={form.end_date}
                onChange={(e) => setForm({...form, end_date: e.target.value})}
                className={styles.formInput} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon (%)", "Commission (%)", "Commission (%)", "Comisión (%)")}</label>
            <input type="number" step="0.1" min="0" max="100"
              value={form.commission_pct}
              onChange={(e) => setForm({...form, commission_pct: parseFloat(e.target.value) || 0})}
              className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Sib Odyans", "Target Audience", "Audience cible", "Audiencia objetivo")}</label>
            <input type="text" value={form.target_audience}
              onChange={(e) => setForm({...form, target_audience: e.target.value})}
              className={styles.formInput}
              placeholder={t4(lang, "Eg: mizisyen, devlòpè", "e.g. musicians, developers", "Ex : musiciens, développeurs", "Ej.: músicos, desarrolladores")} />
          </div>
          <button type="button" className="btn-primary" onClick={handleCreate}>
            <i className="fas fa-save" aria-hidden="true" />
            {t4(lang, "Kreye Kanpay", "Create Campaign", "Créer une campagne", "Crear campaña")}
          </button>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState icon="fa-bullhorn"
          title={t4(lang, "Pokò gen kanpay", "No campaigns yet", "Aucune campagne pour le moment", "Aún no hay campañas")} />
      ) : (
        <div className={styles.list}>
          {campaigns.map((c) => (
            <div key={c.id} className={styles.listItem} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(c.id)}>
              <div className={styles.listAvatar}>
                <i className="fas fa-bullhorn" aria-hidden="true" />
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{c.name}</div>
                <div className={styles.listMeta}>
                  <span className={`${styles.badge} ${styles[`badge${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`] || styles.badgeDraft}`}>
                    {c.status}
                  </span>
                  {' · '}{fmtDate(c.start_date)}{c.end_date ? ` - ${fmtDate(c.end_date)}` : ''}
                  {' · '}{c.commission_pct}%
                </div>
              </div>
              <div className={styles.listActions} onClick={(e) => e.stopPropagation()}>
                {c.status === 'draft' && (
                  <button type="button" className={styles.affiliateBtnApprove}
                    onClick={() => handleAction(c.id, 'activate')}
                    title={t4(lang, "Aktive", "Activate", "Activer", "Activar")}>
                    <i className="fas fa-play" aria-hidden="true" />
                  </button>
                )}
                {c.status === 'active' && (
                  <button type="button" className={styles.affiliateBtnReject}
                    onClick={() => handleAction(c.id, 'pause')}
                    title={t4(lang, "Poz", "Pause", "Pause", "Pausa")}>
                    <i className="fas fa-pause" aria-hidden="true" />
                  </button>
                )}
                {c.status !== 'ended' && c.status !== 'draft' && (
                  <button type="button" className={styles.affiliateBtnReject}
                    onClick={() => handleAction(c.id, 'end')}
                    title={t4(lang, "Fini", "End", "Terminer", "Finalizar")}>
                    <i className="fas fa-stop" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Intelligence Tab — AI-powered insights
// ═══════════════════════════════════════════════════════════════════════

function IntelligenceTab({ lang, t, showToast }) {
  const [activeSection, setActiveSection] = useState('partners');

  const { data: partners, loading: partnersLoading } = useFetch(
    () => affiliateApi.intelligencePartners(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : []) },
  );
  const { data: trends, loading: trendsLoading } = useFetch(
    () => affiliateApi.intelligenceTrends(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : []) },
  );

  const loading = partnersLoading || trendsLoading;

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-robot" aria-hidden="true" />
        {t4(lang, "AI Insights", "AI Insights", "AI Insights", "AI Insights")}
      </h3>

      {/* Partner suggestions */}
      <div className={styles.sectionHeaderRow}>
        <h4 className={styles.sectionSubtitle} style={{ fontSize: '1rem' }}>
          <i className="fas fa-star" aria-hidden="true" />
          {t4(lang, "Pi bon Patnè", "Top Partner Suggestions", "Meilleures suggestions de partenaires", "Mejores sugerencias de socios")}
        </h4>
      </div>

      {partners.length === 0 ? (
        <EmptyState icon="fa-users"
          title={t4(lang, "Pokò gen done", "No data yet", "Aucune donnée pour le moment", "Aún no hay datos")} />
      ) : (
        <div className={styles.list}>
          {partners.map((p) => (
            <div key={p.id} className={styles.listItem}>
              <div className={styles.listAvatar}>{p.username?.charAt(0)?.toUpperCase() || '?'}</div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{p.username}</div>
                <div className={styles.listMeta}>
                  {t4(lang, "Nivo", "Level", "Niveau", "Nivel")}: {p.level} ·
                  {t4(lang, "Konfyans", "Trust", "Confiance", "Confianza")}: {p.trust_score} ·
                  {t4(lang, "Konvèsyon", "Conversions", "Conversions", "Conversiones")}: {p.total_conversions} ·
                  {p.conversion_rate?.toFixed(1)}%
                </div>
              </div>
              <div className={styles.affiliateEarned}>{fmtCurrency(p.total_earned)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sales trends */}
      <div className={styles.sectionHeaderRow} style={{ marginTop: '24px' }}>
        <h4 className={styles.sectionSubtitle} style={{ fontSize: '1rem' }}>
          <i className="fas fa-chart-line" aria-hidden="true" />
          {t4(lang, "Vant 30 Jou", "30-Day Sales Trends", "Tendances des ventes sur 30 jours", "Tendencias de ventas de 30 días")}
        </h4>
      </div>

      {trends.length === 0 ? (
        <EmptyState icon="fa-chart-line"
          title={t4(lang, "Pokò gen vant", "No sales data yet", "Aucune vente pour le moment", "Aún no hay ventas")} />
      ) : (
        <div className={styles.affiliateGrid}>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatValue}>
              {fmtCurrency(trends.reduce((s, t) => s + t.sales, 0))}
            </div>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Total Vant", "Total Sales", "Total ventes", "Total ventas")}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatValue}>
              {fmtCurrency(trends.reduce((s, t) => s + t.commissions, 0))}
            </div>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Total Komisyon", "Total Commissions", "Total commissions", "Total comisiones")}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatValue}>
              {trends.reduce((s, t) => s + t.conversions, 0)}
            </div>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Konvèsyon", "Conversions", "Conversions", "Conversiones")}</div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Wizard Tab — 4-Step Campaign Creation
// ═══════════════════════════════════════════════════════════════════════

const OBJECTIVE_OPTIONS = [
  { value: 'sell_product', icon: 'fa-cube', label: 'Sell Product', labelHt: 'Vann Pwodwi', labelFr: 'Vendre un produit', labelEs: 'Vender producto' },
  { value: 'sell_course', icon: 'fa-graduation-cap', label: 'Sell Course', labelHt: 'Vann Kou', labelFr: 'Vendre un cours', labelEs: 'Vender curso' },
  { value: 'gain_followers', icon: 'fa-users', label: 'Gain Followers', labelHt: 'Atire Swivè', labelFr: 'Gagner des abonnés', labelEs: 'Ganar seguidores' },
  { value: 'increase_views', icon: 'fa-eye', label: 'Increase Views', labelHt: 'Ogmante Vizyon', labelFr: 'Augmenter les vues', labelEs: 'Aumentar vistas' },
  { value: 'promote_profile', icon: 'fa-user-circle', label: 'Promote Profile', labelHt: 'Ankouraje Pwofil', labelFr: 'Promouvoir le profil', labelEs: 'Promocionar perfil' },
  { value: 'promote_event', icon: 'fa-calendar', label: 'Promote Event', labelHt: 'Ankouraje Evènman', labelFr: "Promouvoir l'événement", labelEs: 'Promocionar evento' },
  { value: 'recruit_affiliates', icon: 'fa-handshake', label: 'Recruit Affiliates', labelHt: 'Rekrute Afilye', labelFr: 'Recruter des affiliés', labelEs: 'Reclutar afiliados' },
  { value: 'brand_awareness', icon: 'fa-bullhorn', label: 'Brand Awareness', labelHt: 'Konsyantizasyon', labelFr: 'Notoriété', labelEs: 'Reconocimiento' },
];

function WizardTab({ lang, t, showToast }) {
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState({
    objective: '', target_value: '', target_metric: '',
    asset_type: 'product',
    audience: { countries: [], languages: [], interests: [], follower_similarity: true },
    budget: { total_budget: 100, budget_days: 30, commission_pct: 15 },
  });
  const [estimate, setEstimate] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const updateWizard = useCallback((key, value) => {
    setWizard((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNext = useCallback(() => {
    if (step < 4) setStep((s) => s + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const handleCalculate = useCallback(async () => {
    setCalculating(true);
    try {
      const res = await affiliateApi.dcieCalculateBudget({
        budget_amount: wizard.budget.total_budget,
        budget_days: wizard.budget.budget_days,
        commission_pct: wizard.budget.commission_pct,
      });
      setEstimate(res?.data);
    } catch {
      showToast?.('Calculation failed', 'error');
    } finally {
      setCalculating(false);
    }
  }, [wizard.budget, showToast]);

  const handleCreateFromWizard = useCallback(async () => {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + wizard.budget.budget_days);
      const res = await affiliateApi.createCampaign({
        name: `${OBJECTIVE_OPTIONS.find((o) => o.value === wizard.objective)?.label || 'Campaign'} — ${new Date().toLocaleDateString()}`,
        description: `Campaign objective: ${wizard.objective}`,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        commission_pct: wizard.budget.commission_pct,
        target_audience: (wizard.audience.interests || []).join(', '),
        featured_product_ids: [],
      });
      const newId = res?.data?.id;
      if (newId) {
        const objective = wizard.objective;
        const targetValue = wizard.target_value || '';
        const targetMetric = wizard.target_metric || 'sales';
        const budgetTotal = wizard.budget.total_budget || 100;
        const budgetDays = wizard.budget.budget_days || 30;
        const dailyLimit = budgetTotal / budgetDays;
        const audience = wizard.audience || {};

        await Promise.all([
          affiliateApi.updateCampaignGoal(newId, {
            objective,
            target_value: targetValue ? parseInt(targetValue, 10) : null,
            target_metric: targetMetric,
          }),
          affiliateApi.updateCampaignBudget(newId, {
            total_budget: budgetTotal,
            daily_limit: dailyLimit,
            stop_loss_enabled: true,
            scaling_enabled: false,
            target_roi_pct: 100,
            target_conversion_rate_pct: 2,
          }),
          affiliateApi.updateCampaignAudience(newId, {
            countries: audience.countries || [],
            languages: audience.languages || [],
            interests: audience.interests || [],
            follower_similarity: audience.follower_similarity ?? true,
            previous_buyers: audience.previous_buyers || false,
            previous_engagement: audience.previous_engagement || false,
          }),
        ]);
      }
      showToast?.('Campaign created from wizard!', 'check');
      setStep(1);
      setWizard({
        objective: '', target_value: '', target_metric: '',
        asset_type: 'product',
        audience: { countries: [], languages: [], interests: [], follower_similarity: true },
        budget: { total_budget: 100, budget_days: 30, commission_pct: 15 },
      });
      setEstimate(null);
    } catch {
      showToast?.('Failed to create campaign', 'error');
    }
  }, [wizard, showToast]);

  const stepLabels = [
    t4(lang, "Objektif", "Objective", "Objectif", "Objetivo"),
    t4(lang, "Byen", "Asset", "Élément", "Elemento"),
    t4(lang, "Odyans", "Audience", "Audience", "Audiencia"),
    t4(lang, "Bidjè", "Budget", "Budget", "Presupuesto"),
  ];

  return (
    <div className={styles.section}>
      {/* Step indicator */}
      <div className={styles.affiliateGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={styles.affiliateStatCard}
            style={{
              opacity: s <= step ? 1 : 0.4,
              cursor: 'default',
            }}>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: s <= step ? '#6366f1' : undefined }}>
              {s}
            </div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stepLabels[s - 1]}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Objective */}
      {step === 1 && (
        <div className={styles.affiliateForm}>
          <h4 style={{ margin: '0 0 12px' }}>
            {t4(lang, "Kisa ou vle reyalize?", "What do you want to achieve?", "Que voulez-vous accomplir ?", "¿Qué quieres lograr?")}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {OBJECTIVE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateWizard('objective', opt.value)}
                style={{
                  padding: '12px',
                  border: `2px solid ${wizard.objective === opt.value ? '#6366f1' : 'var(--border-color, #e5e7eb)'}`,
                  borderRadius: '10px',
                  background: wizard.objective === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                <i className={`fas ${opt.icon}`} style={{ fontSize: '1.2rem', color: '#6366f1', display: 'block', marginBottom: '4px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {pickLabel(opt, lang)}
                </span>
              </button>
            ))}
          </div>
          {wizard.objective && (
            <div className={styles.formGroup} style={{ marginTop: '12px' }}>
              <label>{t4(lang, "Objektif nimerik (si genyen)", "Target value (optional)", "Valeur cible (facultatif)", "Valor objetivo (opcional)")}</label>
              <input type="number" className={styles.formInput}
                value={wizard.target_value}
                onChange={(e) => updateWizard('target_value', e.target.value)}
                placeholder={t4(lang, "Eg: 1000, 5000", "e.g. 1000 followers", "Ex : 1000, 5000", "Ej.: 1000, 5000")} />
            </div>
          )}
          <button type="button" className="btn-primary" onClick={handleNext}
            disabled={!wizard.objective}
            style={{ marginTop: '16px' }}>
            {t4(lang, "Pwochen →", "Next →", "Suivant →", "Siguiente →")}
          </button>
        </div>
      )}

      {/* Step 2: Asset */}
      {step === 2 && (
        <div className={styles.affiliateForm}>
          <h4 style={{ margin: '0 0 12px' }}>
            {t4(lang, "Kisa w ap pwomouvwa?", "What are you promoting?", "Que promouvez-vous ?", "¿Qué estás promocionando?")}
          </h4>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Kalite Byen", "Asset Type", "Type d'élément", "Tipo de elemento")}</label>
            <select className={styles.formSelect} value={wizard.asset_type}
              onChange={(e) => updateWizard('asset_type', e.target.value)}>
              <option value="product">{t4(lang, "Pwodwi", "Product", "Produit", "Producto")}</option>
              <option value="course">{t4(lang, "Kou", "Course", "Cours", "Curso")}</option>
              <option value="music">Music</option>
              <option value="service">{t4(lang, "Sèvis", "Service", "Service", "Servicio")}</option>
              <option value="profile">{t4(lang, "Pwofil Kreyatè", "Creator Profile", "Profil créateur", "Perfil de creador")}</option>
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={handleNext}
            style={{ marginTop: '12px' }}>
            {t4(lang, "Pwochen →", "Next →", "Suivant →", "Siguiente →")}
          </button>
          <button type="button" className="btn-secondary" onClick={handleBack}
            style={{ marginLeft: '8px' }}>
            ← {t4(lang, "Retounen", "Back", "Retour", "Atrás")}
          </button>
        </div>
      )}

      {/* Step 3: Audience */}
      {step === 3 && (
        <div className={styles.affiliateForm}>
          <h4 style={{ margin: '0 0 12px' }}>
            {t4(lang, "Ki moun ou vize?", "Who is your target audience?", "Qui visez-vous ?", "¿A quién te diriges?")}
          </h4>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Enterè (separe pa vigil)", "Interests (comma separated)", "Centres d'intérêt (séparés par virgule)", "Intereses (separados por coma)")}</label>
            <input type="text" className={styles.formInput}
              value={(wizard.audience.interests || []).join(', ')}
              onChange={(e) => updateWizard('audience', {
                ...wizard.audience,
                interests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })}
              placeholder={t4(lang, "mizik, teknoloji, atizana", "music, tech, art", "musique, tech, art", "música, tecnología, arte")} />
          </div>
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={wizard.audience.follower_similarity}
                onChange={(e) => updateWizard('audience', { ...wizard.audience, follower_similarity: e.target.checked })}
                style={{ width: '16px', height: '16px' }} />
              {t4(lang, "Moun ki sanble ak swivè m yo", "Users similar to my followers", "Utilisateurs similaires à mes abonnés", "Usuarios similares a mis seguidores")}
            </label>
          </div>
          <button type="button" className="btn-primary" onClick={handleNext}
            style={{ marginTop: '12px' }}>
            {t4(lang, "Pwochen →", "Next →", "Suivant →", "Siguiente →")}
          </button>
          <button type="button" className="btn-secondary" onClick={handleBack}
            style={{ marginLeft: '8px' }}>
            ← {t4(lang, "Retounen", "Back", "Retour", "Atrás")}
          </button>
        </div>
      )}

      {/* Step 4: Budget + Estimate */}
      {step === 4 && (
        <div className={styles.affiliateForm}>
          <h4 style={{ margin: '0 0 12px' }}>
            {t4(lang, "Bidjè ak Previzyon", "Budget & Estimate", "Budget et estimation", "Presupuesto y estimación")}
          </h4>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{t4(lang, "Bidjè Total ($)", "Total Budget ($)", "Budget total ($)", "Presupuesto total ($)")}</label>
              <input type="number" min="1" className={styles.formInput}
                value={wizard.budget.total_budget}
                onChange={(e) => updateWizard('budget', { ...wizard.budget, total_budget: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className={styles.formGroup}>
              <label>{t4(lang, "Dire (jou)", "Duration (days)", "Durée (jours)", "Duración (días)")}</label>
              <input type="number" min="1" className={styles.formInput}
                value={wizard.budget.budget_days}
                onChange={(e) => updateWizard('budget', { ...wizard.budget, budget_days: parseInt(e.target.value, 10) || 30 })} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon Afilye (%)", "Affiliate Commission (%)", "Commission d'affiliation (%)", "Comisión de afiliación (%)")}</label>
            <input type="number" step="0.1" min="0" max="100" className={styles.formInput}
              value={wizard.budget.commission_pct}
              onChange={(e) => updateWizard('budget', { ...wizard.budget, commission_pct: parseFloat(e.target.value) || 0 })} />
          </div>

          <button type="button" className="btn-primary" onClick={handleCalculate} disabled={calculating}
            style={{ marginTop: '8px' }}>
            {calculating ? (
              <><i className="fas fa-spinner fa-spin" /> {t4(lang, "Kalkil...", "Calculating...", "Calcul...", "Calculando...")}</>
            ) : (
              <><i className="fas fa-calculator" /> {t4(lang, "Kalkile Previzyon", "Calculate Estimate", "Calculer l'estimation", "Calcular estimación")}</>
            )}
          </button>

          {estimate && (
            <div className={styles.affiliateGrid} style={{ marginTop: '16px' }}>
              <div className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatValue}>{estimate.estimated_impressions?.toLocaleString() || 0}</div>
                <div className={styles.affiliateStatLabel}>{t4(lang, "Impresyon", "Impressions", "Impressions", "Impresiones")}</div>
              </div>
              <div className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatValue}>{estimate.estimated_clicks?.toLocaleString() || 0}</div>
                <div className={styles.affiliateStatLabel}>{t4(lang, "Klik", "Clicks", "Clics", "Clics")}</div>
              </div>
              <div className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatValue}>{estimate.estimated_conversions?.toLocaleString() || 0}</div>
                <div className={styles.affiliateStatLabel}>{t4(lang, "Konvèsyon", "Conversions", "Conversions", "Conversiones")}</div>
              </div>
              <div className={styles.affiliateStatCard} style={{ borderColor: '#10b981' }}>
                <div className={styles.affiliateStatValue} style={{ color: '#10b981' }}>{fmtCurrency(estimate.estimated_revenue || 0)}</div>
                <div className={styles.affiliateStatLabel}>{t4(lang, "Revni Estime", "Est. Revenue", "Revenu estimé", "Ingresos estimados")}</div>
              </div>
              <div className={styles.affiliateStatCard} style={{ borderColor: estimate?.profit >= 0 ? '#10b981' : '#ef4444' }}>
                <div className={styles.affiliateStatValue}
                  style={{ color: estimate?.profit >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtCurrency(estimate.profit || 0)}
                </div>
                <div className={styles.affiliateStatLabel}>{t4(lang, "Pwofi", "Profit", "Profit", "Beneficio")}</div>
              </div>
              <div className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatValue} style={{ color: estimate?.roi_pct >= 100 ? '#10b981' : '#f59e0b' }}>
                  {estimate.roi_pct?.toFixed(1) || 0}%
                </div>
                <div className={styles.affiliateStatLabel}>ROI</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={handleBack}>
              ← {t4(lang, "Retounen", "Back", "Retour", "Atrás")}
            </button>
            <button type="button" className="btn-primary" onClick={handleCreateFromWizard}>
              <i className="fas fa-check" /> {t4(lang, "Kreye Kanpay", "Create Campaign", "Créer une campagne", "Crear campaña")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Budget Tab — Budget Calculator & Campaign Score
// ═══════════════════════════════════════════════════════════════════════

function BudgetTab({ lang, t, showToast }) {
  const [form, setForm] = useState({ budget_amount: 500, budget_days: 30, commission_pct: 15, cpm: '', ctr_pct: '', cvr_pct: '', aov: '' });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [score, setScore] = useState(null);

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const payload = {
        budget_amount: parseFloat(form.budget_amount) || 100,
        budget_days: parseInt(form.budget_days, 10) || 30,
        commission_pct: parseFloat(form.commission_pct) || 10,
      };
      if (form.cpm) payload.cpm = parseFloat(form.cpm);
      if (form.ctr_pct) payload.ctr_pct = parseFloat(form.ctr_pct);
      if (form.cvr_pct) payload.cvr_pct = parseFloat(form.cvr_pct);
      if (form.aov) payload.aov = parseFloat(form.aov);
      const res = await affiliateApi.dcieCalculateBudget(payload);
      setResult(res?.data);
    } catch {
      showToast?.('Calculation failed', 'error');
    } finally {
      setCalculating(false);
    }
  }, [form, showToast]);

  const calculateScore = useCallback(async () => {
    if (!campaignId) { showToast?.('Enter a campaign ID', 'warning'); return; }
    try {
      const res = await affiliateApi.dcieCalculateScore(parseInt(campaignId, 10));
      setScore(res?.data);
    } catch {
      showToast?.('Score calculation failed', 'error');
    }
  }, [campaignId, showToast]);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-calculator" />
        {t4(lang, "Kalkilatè Bidjè", "Budget Calculator", "Calculateur de budget", "Calculadora de presupuesto")}
      </h3>

      <div className={styles.affiliateForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Bidjè ($)", "Budget ($)", "Budget ($)", "Presupuesto ($)")}</label>
            <input type="number" min="1" className={styles.formInput}
              value={form.budget_amount}
              onChange={(e) => setForm({...form, budget_amount: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Jou", "Days", "Jours", "Días")}</label>
            <input type="number" min="1" className={styles.formInput}
              value={form.budget_days}
              onChange={(e) => setForm({...form, budget_days: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label>{t4(lang, "Komisyon %", "Commission %", "Commission %", "Comisión %")}</label>
            <input type="number" step="0.1" min="0" max="100" className={styles.formInput}
              value={form.commission_pct}
              onChange={(e) => setForm({...form, commission_pct: e.target.value})} />
          </div>
        </div>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
            {t4(lang, "Metrik avanse", "Advanced metrics", "Métriques avancées", "Métricas avanzadas")}
          </summary>
          <div className={styles.formRow} style={{ marginTop: '8px' }}>
            <div className={styles.formGroup}>
              <label>CPM ($)</label>
              <input type="number" step="0.1" className={styles.formInput}
                value={form.cpm} placeholder="8.00"
                onChange={(e) => setForm({...form, cpm: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>CTR %</label>
              <input type="number" step="0.1" className={styles.formInput}
                value={form.ctr_pct} placeholder="1.5"
                onChange={(e) => setForm({...form, ctr_pct: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>CVR %</label>
              <input type="number" step="0.1" className={styles.formInput}
                value={form.cvr_pct} placeholder="2.0"
                onChange={(e) => setForm({...form, cvr_pct: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>{t4(lang, "Valè Mwayèn", "AOV ($)", "Panier moyen ($)", "Valor medio ($)")}</label>
              <input type="number" step="0.1" className={styles.formInput}
                value={form.aov} placeholder="50.00"
                onChange={(e) => setForm({...form, aov: e.target.value})} />
            </div>
          </div>
        </details>
        <button type="button" className="btn-primary" onClick={calculate} disabled={calculating}
          style={{ marginTop: '12px' }}>
          {calculating ? <><i className="fas fa-spinner fa-spin" /> {t4(lang, "Kalkil...", "Calculating...", "Calcul...", "Calculando...")}</>
            : <><i className="fas fa-calculator" /> {t4(lang, "Kalkile", "Calculate", "Calculer", "Calcular")}</>}
        </button>
      </div>

      {result && (
        <div className={styles.affiliateGrid} style={{ marginTop: '16px' }}>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Depans Chak Jou", "Daily Spend", "Dépense quotidienne", "Gasto diario")}</div>
            <div className={styles.affiliateStatValue}>{fmtCurrency(result.daily_spend)}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>Impressions</div>
            <div className={styles.affiliateStatValue}>{result.estimated_impressions?.toLocaleString()}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>Clicks</div>
            <div className={styles.affiliateStatValue}>{result.estimated_clicks?.toLocaleString()}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Konvèsyon", "Conversions", "Conversions", "Conversiones")}</div>
            <div className={styles.affiliateStatValue}>{result.estimated_conversions?.toLocaleString()}</div>
          </div>
          <div className={styles.affiliateStatCard} style={{ borderColor: '#6366f1' }}>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Revni", "Revenue", "Revenu", "Ingresos")}</div>
            <div className={styles.affiliateStatValue} style={{ color: '#6366f1' }}>{fmtCurrency(result.estimated_revenue)}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Komisyon", "Commission Cost", "Coût de commission", "Costo de comisión")}</div>
            <div className={styles.affiliateStatValue}>{fmtCurrency(result.commission_cost)}</div>
          </div>
          <div className={styles.affiliateStatCard} style={{ borderColor: result?.profit >= 0 ? '#10b981' : '#ef4444' }}>
            <div className={styles.affiliateStatLabel}>{t4(lang, "Pwofi", "Profit", "Profit", "Beneficio")}</div>
            <div className={styles.affiliateStatValue} style={{ color: result?.profit >= 0 ? '#10b981' : '#ef4444' }}>{fmtCurrency(result.profit)}</div>
          </div>
          <div className={styles.affiliateStatCard}>
            <div className={styles.affiliateStatLabel}>ROI</div>
            <div className={styles.affiliateStatValue} style={{ color: result?.roi_pct >= 100 ? '#10b981' : '#f59e0b' }}>{result.roi_pct?.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Campaign Score */}
      <h3 className={styles.sectionSubtitle} style={{ marginTop: '32px' }}>
        <i className="fas fa-chart-simple" />
        {t4(lang, "Skò Kanpay", "Campaign Score", "Score de campagne", "Puntuación de campaña")}
      </h3>
      <div className={styles.affiliateForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "ID Kanpay", "Campaign ID", "ID de campagne", "ID de campaña")}</label>
            <input type="number" className={styles.formInput}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={calculateScore}>
              <i className="fas fa-star" /> {t4(lang, "Kalkile Skò", "Calculate Score", "Calculer le score", "Calcular puntuación")}
            </button>
          </div>
        </div>
      </div>

      {score && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '50%',
            background: score.overall_score >= 70 ? '#10b981' : score.overall_score >= 40 ? '#f59e0b' : '#ef4444',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: '#fff',
          }}>
            <span style={{ fontSize: '2rem', fontWeight: 700 }}>{score.overall_score}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>/ 100</span>
          </div>
          <div className={styles.affiliateGrid}>
            {Object.entries(score.components || {}).map(([key, val]) => (
              <div key={key} className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatLabel}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
                <div className={styles.affiliateStatValue}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// AI Assist Tab — Optimization Engine + AI Assistant
// ═══════════════════════════════════════════════════════════════════════

function AIAssistTab({ lang, t, showToast }) {
  const [campaignId, setCampaignId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [optimizations, setOptimizations] = useState([]);
  const [advice, setAdvice] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [audienceInsights, setAudienceInsights] = useState(null);

  const runAnalysis = useCallback(async () => {
    if (!campaignId) { showToast?.('Enter a campaign ID', 'warning'); return; }
    setAnalyzing(true);
    try {
      const res = await affiliateApi.dcieAnalyze(parseInt(campaignId, 10));
      setAnalysis(res?.data?.analysis);
      setOptimizations(res?.data?.optimizations || []);
    } catch {
      showToast?.('Analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  }, [campaignId, showToast]);

  const analyzeAudience = useCallback(async () => {
    if (!campaignId) { showToast?.('Enter a campaign ID', 'warning'); return; }
    try {
      const res = await affiliateApi.dcieAnalyzeAudience(parseInt(campaignId, 10));
      setAudienceInsights(res?.data);
    } catch {
      showToast?.('Audience analysis failed', 'error');
    }
  }, [campaignId, showToast]);

  const getAdvice = useCallback(async () => {
    try {
      const res = await affiliateApi.dcieGetAdvice();
      setAdvice(res?.data?.advice || []);
    } catch {
      showToast?.('Failed to get advice', 'error');
    }
  }, [showToast]);

  return (
    <div className={styles.section}>
      {/* Campaign selector */}
      <div className={styles.affiliateForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>{t4(lang, "ID Kanpay", "Campaign ID", "ID de campagne", "ID de campaña")}</label>
            <input type="number" className={styles.formInput}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? <><i className="fas fa-spinner fa-spin" /> Analyze</>
                : <><i className="fas fa-robot" /> {t4(lang, "Analize", "Analyze", "Analyser", "Analizar")}</>}
            </button>
            <button type="button" className="btn-secondary" onClick={analyzeAudience}>
              <i className="fas fa-users" /> {t4(lang, "Odyans", "Audience", "Audience", "Audiencia")}
            </button>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className={styles.affiliateForm} style={{ marginTop: '16px', borderLeft: '4px solid #6366f1' }}>
          <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-robot" style={{ color: '#6366f1' }} />
            {t4(lang, "Analiz Kanpay", "Campaign Analysis", "Analyse de campagne", "Análisis de campaña")}
          </h4>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {analysis.insights?.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Audience Insights */}
      {audienceInsights && (
        <div className={styles.affiliateForm} style={{ marginTop: '12px', borderLeft: '4px solid #a855f7' }}>
          <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-users" style={{ color: '#a855f7' }} />
            {t4(lang, "Analiz Odyans", "Audience Analysis", "Analyse d'audience", "Análisis de audiencia")}
          </h4>
          {audienceInsights.estimated_size > 0 && (
            <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
              <strong>{t4(lang, "Gwosè odyans", "Audience size", "Taille d'audience", "Tamaño de audiencia")}:</strong>{' '}
              {audienceInsights.estimated_size.toLocaleString()}
            </p>
          )}
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {audienceInsights.insights?.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Optimizations */}
      {optimizations.length > 0 && (
        <>
          <h3 className={styles.sectionSubtitle} style={{ marginTop: '24px' }}>
            <i className="fas fa-microchip" />
            {t4(lang, "Rekòmandasyon Optimizasyon", "Optimization Recommendations", "Recommandations d'optimisation", "Recomendaciones de optimización")}
          </h3>
          <div className={styles.list}>
            {optimizations.map((opt) => (
              <div key={opt.id} className={styles.listItem} style={{ borderLeft: `4px solid ${opt.priority >= 2 ? '#ef4444' : '#f59e0b'}` }}>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    {opt.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </div>
                  <div className={styles.listMeta}>{opt.reason}</div>
                  {opt.expected_impact && (
                    <div className={styles.listMeta} style={{ color: '#10b981', fontWeight: 600 }}>
                      {t4(lang, "Efè espere", "Expected impact", "Impact attendu", "Impacto esperado")}: {opt.expected_impact}
                    </div>
                  )}
                </div>
                <span className={`${styles.badge} ${opt.is_applied ? styles.badgeCompleted : styles.badgePending}`}>
                  {opt.is_applied ? (t4(lang, "Aplike", "Applied", "Appliqué", "Aplicado")) : (t4(lang, "An atant", "Pending", "En attente", "Pendiente"))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Advice */}
      <div className={styles.sectionHeaderRow} style={{ marginTop: '24px' }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-lightbulb" />
          {t4(lang, "Konsey Jeneral", "General Advice", "Conseils généraux", "Consejos generales")}
        </h3>
        <button type="button" className="btn-secondary" onClick={getAdvice}>
          <i className="fas fa-sync" />
        </button>
      </div>

      {advice.length === 0 ? (
        <EmptyState icon="fa-lightbulb"
          title={t4(lang, "Klike pou jwenn konsey", "Click to get advice", "Cliquez pour obtenir des conseils", "Haz clic para obtener consejos")} />
      ) : (
        <div className={styles.affiliateForm} style={{ borderLeft: '4px solid #f59e0b' }}>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Main Section Component
// ═══════════════════════════════════════════════════════════════════════

export default function AffiliateSection({ lang, t, showToast }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-handshake"
        title={t4(lang, "Afilyasyon", "Affiliate", "Affiliation", "Afiliación")}
        lang={lang}
        help={{
          ht: 'Jere pwogram afilyasyon ou — afilye yo, komisyon, gwoup, règ, kanpay ak analytics. Aktiv pwogram nan pou kòmanse aksepte afilye.',
          en: 'Manage your affiliate program — affiliates, commissions, groups, rules, campaigns and analytics. Activate the program to start accepting affiliates.',
          fr: "Gérez votre programme d'affiliation — affiliés, commissions, groupes, règles, campagnes et analyses. Activez le programme pour commencer à accepter des affiliés.",
          es: 'Gestiona tu programa de afiliación — afiliados, comisiones, grupos, reglas, campañas y análisis. Activa el programa para empezar a aceptar afiliados.',
        }}
        tip={t4(lang, "Afilye yo touche komisyon sou chak vant ki soti nan lyen yo.", "Affiliates earn a commission on every sale that comes through their links.", "Les affiliés touchent une commission sur chaque vente issue de leurs liens.", "Los afiliados ganan una comisión por cada venta que llegue a través de sus enlaces.")}
      />

      {/* Sub-tabs */}
      <div className={styles.affiliateTabs}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.affiliateTab} ${activeTab === tab.id ? styles.affiliateTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />
            {pickLabel(tab, lang)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.affiliateTabContent}>
        {activeTab === 'overview' && <OverviewTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'settings' && <SettingsTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'members' && <MembersTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'applications' && <ApplicationsTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'conversions' && <ConversionsTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'groups' && <GroupsTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'rules' && <RulesTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'campaigns' && <CampaignsTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'intelligence' && <IntelligenceTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'wizard' && <WizardTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'budget' && <BudgetTab lang={lang} t={t} showToast={showToast} />}
        {activeTab === 'ai-assist' && <AIAssistTab lang={lang} t={t} showToast={showToast} />}
      </div>
    </div>
  );
}
