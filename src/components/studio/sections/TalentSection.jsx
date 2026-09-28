/**
 * src/components/studio/sections/TalentSection.jsx
 *
 * Talent section — list, create, edit, delete talents for the Explore catalog.
 * Uses the explore/talents API. Mirrors MusicSection pattern.
 */
import React, { useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { exploreService, talentService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

export default function TalentSection({ lang, t, showToast, setShowTalentModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const { data: talents, loading, refetch } = useFetch(
    () => exploreService.talents({ mine: true }),
    { defaultValue: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase talan' : 'Delete talent',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.name}"?` : `Are you sure you want to delete "${item.name}"?`,
      onConfirm: async () => {
        try {
          await talentService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Talan efase!' : '✅ Talent deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  // Quick visibility toggle — flips is_active without opening the modal.
  const handleToggleActive = async (item) => {
    try {
      await talentService.update(item.id, { is_active: !item.is_active });
      showToast?.(
        !item.is_active
          ? (lang === 'ht' ? '✅ Talan vizib kounye a!' : '✅ Talent is now visible!')
          : (lang === 'ht' ? '🙈 Talan kache.' : '🙈 Talent hidden.'),
        'eye',
      );
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab chanje vizibilite.' : 'Could not change visibility.'), 'circle-exclamation');
    }
  };

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = talents.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-star"
        title={lang === 'ht' ? 'Talan mwen yo' : 'My Talents'}
        lang={lang}
        help={{
          ht: 'Lised tout talan (chantè, dansè, atis...) ou te ajoute nan Explore. Yon bon avatè kare (1:1) fè talan an pi vizib sou kard la.',
          en: 'Every talent (singer, dancer, artist…) you added to Explore. A strong square (1:1) avatar makes the talent more visible on its card.',
        }}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowTalentModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {lang === 'ht' ? 'Kreye Talan' : 'Create Talent'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-star"
          title={lang === 'ht' ? 'PokO gen talan' : 'No talents yet'}
          hint={lang === 'ht'
            ? 'Kreye premye talan ou pou parèt nan Explore.'
            : 'Create your first talent to appear in Explore.'}
          ctaLabel={lang === 'ht' ? 'Kreye Premye Talan' : 'Create First Talent'}
          onCta={() => setShowTalentModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {talents.map((talent) => (
            <div key={talent.id} className={styles.listItem}>
              <img
                className={`${styles.listThumb} ${styles.listThumbRound}`}
                src={talent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(talent.name || '?')}&background=2563eb&color=ffffff&size=80`}
                alt={talent.name}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(talent.name || '?')}&background=2563eb&color=ffffff&size=80`;
                }}
              />
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {talent.name}
                  {talent.is_active === false && (
                    <span className={styles.inactiveBadge}>
                      <i className="fas fa-eye-slash" aria-hidden="true" />
                      {lang === 'ht' ? 'Kache' : 'Hidden'}
                    </span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  {talent.role && <span>{talent.role}</span>}
                  {talent.location && <span> · {talent.location}</span>}
                  {talent.is_featured && (
                    <span className={styles.featuredBadge}>
                      <i className="fas fa-star" aria-hidden="true" /> Featured
                    </span>
                  )}
                </div>
                {talent.linked_username && (
                  <div className={styles.listMeta} style={{ color: 'var(--color-primary, #2563eb)' }}>
                    <i className="fas fa-user-check" aria-hidden="true" style={{ marginRight: 4 }} />
                    @{talent.linked_username}
                  </div>
                )}
                {Array.isArray(talent.skills) && talent.skills.length > 0 && (
                  <div className={styles.tagRow}>
                    {talent.skills.slice(0, 4).map((s) => (
                      <span key={s} className={styles.tag}>{s}</span>
                    ))}
                    {talent.skills.length > 4 && (
                      <span className={styles.tag}>+{talent.skills.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => handleToggleActive(talent)}
                  title={talent.is_active === false
                    ? (lang === 'ht' ? 'Fè l vizib' : 'Make visible')
                    : (lang === 'ht' ? 'Kache' : 'Hide')}
                  aria-label={talent.is_active === false
                    ? (lang === 'ht' ? 'Fè talan an vizib' : 'Make talent visible')
                    : (lang === 'ht' ? 'Kache talan an' : 'Hide talent')}
                >
                  <i className={talent.is_active === false ? 'fas fa-eye' : 'fas fa-eye-slash'} aria-hidden="true" />
                </button>
                <button type="button" className={styles.editBtn} onClick={() => onEdit?.(talent)}
                  title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(talent)}
                  title={lang === 'ht' ? 'Efase' : 'Delete'}>
                  <i className="fas fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          lang={lang}
          variant="danger"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
