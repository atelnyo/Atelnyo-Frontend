/**
 * src/components/studio/modals/ProfileEditModal.jsx
 *
 * Modal for editing creator profile: username, email, artist name, bio,
 * country, city, website, contact email, phone, experience, education,
 * social links.
 *
 * PATCHes /api/me/ for auth fields and /api/creator-profiles/me/ for
 * public profile fields.
 *
 * Layout: the fields are grouped into raised premium cards (Identity /
 * Biography / Location / Story / Contact & Links) — the same card system
 * as the Public Profile section editor, so both editors read as one.
 */
import React, { useState, useCallback, useEffect } from 'react';
import api, { applyTokenPair, creatorProfileService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';
import { t as t4 } from '../../../utils/i18n';

// Repeatable-entry defaults for the dynamic list editors (experience /
// education / social links) — same shapes the backend model stores.
const EMPTY_EXPERIENCE = { title: '', company: '', period: '', description: '' };
const EMPTY_EDUCATION = { institution: '', degree: '', year: '', description: '' };
const EMPTY_SOCIAL = { platform: '', url: '' };

export default function ProfileEditModal({ onClose, onSuccess, lang, showToast, user }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    artist_name: '',
    bio: '',
    country: '',
    city: '',
    website_url: '',
    contact_email: '',
    contact_phone: '',
    languages: [],
    skills: [],
    experience: [],
    education: [],
    social_links: [],
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Defer the synchronous setState into a microtask so the effect body
    // stays clean (react-hooks/set-state-in-effect — same deferral pattern
    // as PublicProfileSection). The returned cleanup cancels a stale load
    // when the modal closes / user changes.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setProfileLoading(true);
      creatorProfileService.getMe?.().then((res) => {
        if (cancelled || !res?.data) return;
        const p = res.data;
        setForm((f) => ({
          ...f,
          artist_name: p.artist_name || '',
          bio: p.bio || '',
          country: p.country || '',
          city: p.city || '',
          website_url: p.website_url || '',
          contact_email: p.contact_email || '',
          contact_phone: p.contact_phone || '',
          languages: Array.isArray(p.languages) ? p.languages : [],
          skills: Array.isArray(p.skills) ? p.skills : [],
          experience: Array.isArray(p.experience) ? p.experience : [],
          education: Array.isArray(p.education) ? p.education : [],
          // Backend stores social_links as a {platform: url} dict; the form
          // edits them as rows — convert dict → [{platform, url}].
          social_links: (() => {
            const raw = p.social_links;
            if (Array.isArray(raw)) return raw;
            if (raw && typeof raw === 'object') {
              return Object.entries(raw).map(([platform, url]) => ({ platform, url }));
            }
            return [];
          })(),
        }));
        setProfileLoading(false);
      }).catch(() => setProfileLoading(false));
    });
    return () => { cancelled = true; };
  }, [user]);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [errors]);

  // Repeatable-row helpers (same pattern as CompanySection): edit/add/remove
  // an entry inside form.experience / form.education / form.social_links.
  const updateRow = useCallback((key, idx, patch) =>
    setForm((f) => ({ ...f, [key]: f[key].map((row, i) => (i === idx ? { ...row, ...patch } : row)) })), []);
  const addRow = useCallback((key, empty) =>
    setForm((f) => ({ ...f, [key]: [...(Array.isArray(f[key]) ? f[key] : []), { ...empty }] })), []);
  const removeRow = useCallback((key, idx) =>
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) })), []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = {};
    if (!form.username.trim()) errs.username = t4(lang, "Non itilizatè oblije", "Username required", "Nom d'utilisateur requis", "Nombre de usuario obligatorio");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const authPayload = { username: form.username.trim() };
      if (form.email.trim()) authPayload.email = form.email.trim();
      const authRes = await api.patch('me/', authPayload);
      if (authRes?.data) {
        applyTokenPair({ user: authRes.data });
        try {
          window.dispatchEvent(new CustomEvent('atelnyo:auth:user-updated', { detail: { user: authRes.data } }));
        } catch (_) {}
      }
      const profilePayload = {
        artist_name: form.artist_name,
        bio: form.bio,
        country: form.country,
        city: form.city,
        website_url: form.website_url,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        languages: form.languages,
        skills: form.skills,
        // Drop empty rows, then convert to the backend's stored shapes
        // (experience/education lists, social_links {platform: url} dict).
        experience: (Array.isArray(form.experience) ? form.experience : [])
          .filter((x) => x.title?.trim() || x.company?.trim()),
        education: (Array.isArray(form.education) ? form.education : [])
          .filter((x) => x.institution?.trim() || x.degree?.trim()),
        social_links: Object.fromEntries(
          (Array.isArray(form.social_links) ? form.social_links : [])
            .filter((s) => s.platform?.trim() && s.url?.trim())
            .map((s) => [s.platform.trim().toLowerCase(), s.url.trim()]),
        ),
      };
      await creatorProfileService.updateMe(profilePayload);
      showToast?.(t4(lang, "✅ Pwofil mete ajou!", "✅ Profile updated!", "✅ Profil mis à jour !", "✅ ¡Perfil actualizado!"), 'check-circle');
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail || err?.response?.data?.username?.[0]
        || err?.message
        || (t4(lang, "Pa t kapab mete pwofil la ajou.", "Could not update profile.", "Impossible de mettre à jour le profil.", "No se pudo actualizar el perfil."));
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-user-circle" wide
      title={t4(lang, "Pwofil Creator", "Creator Profile", "Profil Créateur", "Perfil de creador")}
      subtitle={t4(lang, "Mete ajou enpres ou, kontak ou ak istwa ou", "Update your identity, contact info and story", "Mettez à jour votre identité, vos coordonnées et votre histoire", "Actualiza tu identidad, contacto e historia")}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={profileLoading || loading}>
          <div className={styles.formCards}>

            {/* ─── Identity — username + login email + brand name ── */}
            <div className={`${styles.formCard} ${styles.formCardIndigo}`}>
              <div className={styles.formCardTitle}>
                <i className="fas fa-user-circle" aria-hidden="true" />
                <div>
                  <h4>{t4(lang, "Idantite", "Identity", "Identité", "Identidad")}</h4>
                  <p className={styles.formCardHint}>
                    {t4(lang, "Non ou, imèl koneksyon ak non mak ou.", "Your username, login email and brand name.", "Votre nom d'utilisateur, e-mail de connexion et nom de marque.", "Tu nombre de usuario, correo de acceso y nombre de marca.")}
                  </p>
                </div>
              </div>
              <div className={styles.formCardFields}>
                <FormField label={t4(lang, "Non Itilizatè", "Username", "Nom d'utilisateur", "Nombre de usuario")} required error={errors.username}>
                  <input className={styles.input} value={form.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder={t4(lang, "Non ou", "Your username", "Votre nom d'utilisateur", "Tu nombre de usuario")}
                    maxLength={150} autoFocus />
                </FormField>
                <FormField label="Email" error={errors.email}
                  hint={t4(lang, "Imèl koneksyon ou", "Your login email", "Votre e-mail de connexion", "Tu correo de acceso")}>
                  <input className={styles.input} type="email" value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="user@example.com" maxLength={254} />
                </FormField>
                <FormField label={t4(lang, "Non Artist / Brand", "Artist / Brand Name", "Nom d'artiste / Marque", "Nombre de artista / Marca")}>
                  <input className={styles.input} value={form.artist_name}
                    onChange={(e) => handleChange('artist_name', e.target.value)}
                    placeholder={t4(lang, "Non piblik ou", "Your public brand name", "Votre nom de marque public", "Tu nombre de marca público")}
                    maxLength={120} />
                </FormField>
              </div>
            </div>

            {/* ─── Biography ────────────────────────────────────── */}
            <div className={`${styles.formCard} ${styles.formCardRose}`}>
              <div className={styles.formCardTitle}>
                <i className="fas fa-align-left" aria-hidden="true" />
                <div>
                  <h4>{t4(lang, "Biyografi", "Biography", "Biographie", "Biografía")}</h4>
                  <p className={styles.formCardHint}>
                    {t4(lang, "Deskripsyon kout sou ou — li parèt anba non ou.", "A short description about you — shown under your name.", "Une courte description de vous — affichée sous votre nom.", "Una breve descripción sobre ti — se muestra bajo tu nombre.")}
                  </p>
                </div>
              </div>
              <div className={styles.formCardFields}>
                <FormField label={t4(lang, "Biografi", "Bio", "Bio", "Bio")}>
                  <textarea className={styles.input} value={form.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    placeholder={t4(lang, "Kout deskripsyon...", "Short bio...", "Courte bio...", "Bio corta...")}
                    rows={3} maxLength={500} />
                </FormField>
              </div>
            </div>

            {/* ─── Location ─────────────────────────────────────── */}
            <div className={`${styles.formCard} ${styles.formCardTeal}`}>
              <div className={styles.formCardTitle}>
                <i className="fas fa-map-marker-alt" aria-hidden="true" />
                <div>
                  <h4>{t4(lang, "Lokalizasyon", "Location", "Localisation", "Ubicación")}</h4>
                  <p className={styles.formCardHint}>
                    {t4(lang, "Vil ak peyi kote w ye.", "The city and country where you are.", "La ville et le pays où vous vous trouvez.", "La ciudad y el país donde estás.")}
                  </p>
                </div>
              </div>
              <div className={styles.formCardFields}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label={t4(lang, "Vil", "City", "Ville", "Ciudad")}>
                    <input className={styles.input} value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder={t4(lang, "Vil ou", "City", "Votre ville", "Tu ciudad")} maxLength={100} />
                  </FormField>
                  <FormField label={t4(lang, "Peyi", "Country", "Pays", "País")}>
                    <input className={styles.input} value={form.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      placeholder={t4(lang, "Peyi ou", "Country", "Votre pays", "Tu país")} maxLength={60} />
                  </FormField>
                </div>
              </div>
            </div>

            {/* ─── Story — experience + education (About tab) ───── */}
            <div className={`${styles.formCard} ${styles.formCardAmber}`}>
              <div className={styles.formCardTitle}>
                <i className="fas fa-briefcase" aria-hidden="true" />
                <div>
                  <h4>{t4(lang, "Istwa", "Story", "Histoire", "Historia")}</h4>
                  <p className={styles.formCardHint}>
                    {t4(lang, "Eksperyans pwofesyonèl ak edikasyon ou — yo parèt nan tab About la.", "Your professional experience and education — shown in the About tab.", "Votre expérience professionnelle et votre formation — affichées dans l'onglet À propos.", "Tu experiencia profesional y educación — se muestran en la pestaña Acerca de.")}
                  </p>
                </div>
              </div>
              <div className={styles.formCardFields}>
                {/* Experience — repeatable work history */}
                <div>
                  <div className={styles.formRepeatTitle}>
                    <span className={styles.fieldLabel}>
                      {t4(lang, "Eksperyans", "Experience", "Expérience", "Experiencia")}
                    </span>
                    <button type="button" className={styles.formAddChip}
                      onClick={() => addRow('experience', EMPTY_EXPERIENCE)}>
                      <i className="fas fa-plus" aria-hidden="true" /> {t4(lang, "Ajoute", "Add", "Ajouter", "Añadir")}
                    </button>
                  </div>
                  {!form.experience?.length && (
                    <span className={styles.hint}>
                      {t4(lang, "Pa gen eksperyans ankò.", "No experience yet.", "Aucune expérience pour le moment.", "Aún no hay experiencia.")}
                    </span>
                  )}
                  {(form.experience || []).map((exp, i) => (
                    <div key={`exp-${i}`} className={styles.formRepeatRow} style={{ marginTop: 8 }}>
                      <div className={styles.row}>
                        <input className={styles.input} value={exp.title || ''}
                          onChange={(e) => updateRow('experience', i, { title: e.target.value })}
                          placeholder={t4(lang, "Pòs", "Role", "Poste", "Puesto")} />
                        <input className={styles.input} value={exp.company || ''}
                          onChange={(e) => updateRow('experience', i, { company: e.target.value })}
                          placeholder={t4(lang, "Konpanyi", "Company", "Entreprise", "Empresa")} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <input className={styles.input} style={{ flex: 1 }} value={exp.period || ''}
                          onChange={(e) => updateRow('experience', i, { period: e.target.value })}
                          placeholder={t4(lang, "Peryòd (eg. 2022 — 2025)", "Period (e.g. 2022 — 2025)", "Période (ex : 2022 — 2025)", "Período (ej.: 2022 — 2025)")} />
                        <button type="button" onClick={() => removeRow('experience', i)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', minHeight: 46 }}
                          aria-label={t4(lang, "Retire", "Remove", "Retirer", "Quitar")}>
                          <i className="fas fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                      <textarea className={styles.textarea} style={{ minHeight: 64 }} value={exp.description || ''}
                        onChange={(e) => updateRow('experience', i, { description: e.target.value })}
                        placeholder={t4(lang, "Deskripsyon...", "Description...", "Description...", "Descripción...")} />
                    </div>
                  ))}
                </div>

                {/* Education — repeatable */}
                <div>
                  <div className={styles.formRepeatTitle}>
                    <span className={styles.fieldLabel}>
                      {t4(lang, "Edikasyon", "Education", "Formation", "Educación")}
                    </span>
                    <button type="button" className={styles.formAddChip}
                      onClick={() => addRow('education', EMPTY_EDUCATION)}>
                      <i className="fas fa-plus" aria-hidden="true" /> {t4(lang, "Ajoute", "Add", "Ajouter", "Añadir")}
                    </button>
                  </div>
                  {!form.education?.length && (
                    <span className={styles.hint}>
                      {t4(lang, "Pa gen edikasyon ankò.", "No education yet.", "Aucune formation pour le moment.", "Aún no hay educación.")}
                    </span>
                  )}
                  {(form.education || []).map((edu, i) => (
                    <div key={`edu-${i}`} className={styles.formRepeatRow} style={{ marginTop: 8 }}>
                      <div className={styles.row}>
                        <input className={styles.input} value={edu.institution || ''}
                          onChange={(e) => updateRow('education', i, { institution: e.target.value })}
                          placeholder={t4(lang, "Enstitisyon", "Institution", "Institution", "Institución")} />
                        <input className={styles.input} value={edu.degree || ''}
                          onChange={(e) => updateRow('education', i, { degree: e.target.value })}
                          placeholder={t4(lang, "Diplòm", "Degree", "Diplôme", "Título")} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <input className={styles.input} style={{ flex: 1 }} value={edu.year || ''}
                          onChange={(e) => updateRow('education', i, { year: e.target.value })}
                          placeholder={t4(lang, "Ane (eg. 2023)", "Year (e.g. 2023)", "Année (ex : 2023)", "Año (ej.: 2023)")} />
                        <button type="button" onClick={() => removeRow('education', i)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', minHeight: 46 }}
                          aria-label={t4(lang, "Retire", "Remove", "Retirer", "Quitar")}>
                          <i className="fas fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                      <textarea className={styles.textarea} style={{ minHeight: 64 }} value={edu.description || ''}
                        onChange={(e) => updateRow('education', i, { description: e.target.value })}
                        placeholder={t4(lang, "Deskripsyon...", "Description...", "Description...", "Descripción...")} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Contact & Links — website, email, phone, social ── */}
            <div className={`${styles.formCard} ${styles.formCardCyan}`}>
              <div className={styles.formCardTitle}>
                <i className="fas fa-share-alt" aria-hidden="true" />
                <div>
                  <h4>{t4(lang, "Kontak & Lyen", "Contact & Links", "Contact et liens", "Contacto y enlaces")}</h4>
                  <p className={styles.formCardHint}>
                    {t4(lang, "Sit ou ak fason moun ka kontakte ou.", "Your website and how people can reach you.", "Votre site web et comment vous joindre.", "Tu sitio web y cómo contactarte.")}
                  </p>
                </div>
              </div>
              <div className={styles.formCardFields}>
                <FormField label={t4(lang, "Sit Web", "Website", "Site web", "Sitio web")}>
                  <input className={styles.input} type="url" value={form.website_url}
                    onChange={(e) => handleChange('website_url', e.target.value)}
                    placeholder="https://..." maxLength={500} />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label={t4(lang, "Imèl Kontak", "Contact Email", "E-mail de contact", "Correo de contacto")}>
                    <input className={styles.input} type="email" value={form.contact_email}
                      onChange={(e) => handleChange('contact_email', e.target.value)}
                      placeholder="contact@example.com" maxLength={254} />
                  </FormField>
                  <FormField label={t4(lang, "Telefòn", "Phone", "Téléphone", "Teléfono")}>
                    <input className={styles.input} type="tel" value={form.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      placeholder="+509..." maxLength={30} />
                  </FormField>
                </div>

                {/* Social Links — repeatable platform → url */}
                <div>
                  <div className={styles.formRepeatTitle}>
                    <span className={styles.fieldLabel}>
                      {t4(lang, "Lyen Sosyal", "Social Links", "Liens sociaux", "Enlaces sociales")}
                    </span>
                    <button type="button" className={styles.formAddChip}
                      onClick={() => addRow('social_links', EMPTY_SOCIAL)}>
                      <i className="fas fa-plus" aria-hidden="true" /> {t4(lang, "Ajoute", "Add", "Ajouter", "Añadir")}
                    </button>
                  </div>
                  {!form.social_links?.length && (
                    <span className={styles.hint}>
                      {t4(lang, "Pa gen lyen sosyal.", "No social links yet.", "Aucun lien social pour le moment.", "Aún no hay enlaces sociales.")}
                    </span>
                  )}
                  {(form.social_links || []).map((s, i) => (
                    <div key={`social-${i}`} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input className={styles.input} style={{ flex: 1 }} value={s.platform || ''}
                        onChange={(e) => updateRow('social_links', i, { platform: e.target.value })}
                        placeholder={t4(lang, "Platfòm (instagram, github…)", "Platform (instagram, github…)", "Plateforme (instagram, github…)", "Plataforma (instagram, github…)")} />
                      <input className={styles.input} style={{ flex: 2 }} value={s.url || ''}
                        onChange={(e) => updateRow('social_links', i, { url: e.target.value })}
                        placeholder="https://…" />
                      <button type="button" onClick={() => removeRow('social_links', i)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', minHeight: 46 }}
                        aria-label={t4(lang, "Retire", "Remove", "Retirer", "Quitar")}>
                        <i className="fas fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {t4(lang, "Anile", "Cancel", "Annuler", "Cancelar")}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {t4(lang, "Ap sove...", "Saving...", "Enregistrement...", "Guardando...")}</>
            ) : (
              <><i className="fas fa-save" /> {t4(lang, "Sove Chanjman", "Save Changes", "Enregistrer les modifications", "Guardar cambios")}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
