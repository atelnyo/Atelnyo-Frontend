/**
 * src/components/studio/sections/MusicSection.jsx
 *
 * Music section — lists creator's music tracks. Uses recommended service
 * as a proxy until a dedicated creator-music endpoint exists.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useState } from 'react';
import { exploreService, musicService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

export default function MusicSection({ lang, t, showToast, setShowMusicModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const { data: music, loading, refetch } = useFetch(
    () => exploreService.music({ mine: true }),
    { defaultValue: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase mizik' : 'Delete track',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: async () => {
        try {
          await musicService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Mizik efase!' : '✅ Track deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = music.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-music"
        title={t.studio_my_music || 'My Music'}
        lang={lang}
        help={{
          ht: 'Seksyon sa a lised tout mizik ou te pibliye. Klike "Upload Music" pou ajoute yon track — ou ka mete yon kouvèti, yon preview odyo, ak yon videyo (YouTube/Vimeo/MP4).',
          en: 'This section lists every track you published. Click "Upload Music" to add one — you can attach a cover, an audio preview, and a video (YouTube/Vimeo/MP4).',
        }}
        tip={lang === 'ht'
          ? 'Preview odyo ak videyo gen deteksyon dire otomatik — pa bezwen kalkile anyen.'
          : 'Audio and video previews get auto-detected durations — no math needed.'}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowMusicModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {t.studio_upload_music || 'Upload Music'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-music"
          title={t.studio_no_music || 'No music tracks yet'}
          hint={t.studio_no_music_hint || 'Upload your first track and share it with the world.'}
          ctaLabel={t.studio_upload_first || 'Upload First Track'}
          onCta={() => setShowMusicModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {music.map((track) => (
            <div key={track.id} className={styles.listItem}>
              <img
                className={`${styles.listThumb} ${styles.listThumbRound}`}
                src={track.cover_url || `https://via.placeholder.com/80/0084ff/ffffff?text=${encodeURIComponent(track.title?.[0] || 'M')}`}
                alt={track.title}
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/80/0084ff/ffffff?text=${encodeURIComponent(track.title?.[0] || 'M')}`;
                }}
              />
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{track.title}</div>
                <div className={styles.listMeta}>
                  <span>{track.artist}</span>
                  {track.genre && <span>· {track.genre}</span>}
                  {track.plays > 0 && <span>· {fmtCount(track.plays)} plays</span>}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.editBtn} onClick={() => onEdit?.(track)}
                  title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(track)}
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
