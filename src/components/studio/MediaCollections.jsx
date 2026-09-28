/**
 * MediaCollections — Jesyon koleksyon medya.
 *
 * Creator ka òganize medya li nan koleksyon tankou:
 *   Course Assets, Music Covers, Course Banners,
 *   Profile Images, Community Covers, Product Images,
 *   Portfolio, Marketing Assets, Documents, Certificates
 *
 * Koleksyon pa deplase fichye. Yo sèlman òganize referans.
 */
import React, { useState } from 'react';
import MediaCard from '../media/MediaCard';

const PREDEFINED_COLLECTIONS = [
  { id: 'course_assets', icon: 'fa-graduation-cap', en: 'Course Assets', ht: 'Ressous Kou' },
  { id: 'music_covers', icon: 'fa-music', en: 'Music Covers', ht: 'Kouvèti Mizik' },
  { id: 'course_banners', icon: 'fa-image', en: 'Course Banners', ht: 'Banyè Kou' },
  { id: 'profile_images', icon: 'fa-user-circle', en: 'Profile Images', ht: 'Imaj Pwofil' },
  { id: 'community_covers', icon: 'fa-users', en: 'Community Covers', ht: 'Kouvèti Kominote' },
  { id: 'product_images', icon: 'fa-cube', en: 'Product Images', ht: 'Imaj Pwodwi' },
  { id: 'portfolio', icon: 'fa-briefcase', en: 'Portfolio', ht: 'Pòtfolyo' },
  { id: 'marketing', icon: 'fa-bullhorn', en: 'Marketing Assets', ht: 'Ressous Maketing' },
  { id: 'documents', icon: 'fa-file-alt', en: 'Documents', ht: 'Dokiman' },
  { id: 'certificates', icon: 'fa-certificate', en: 'Certificates', ht: 'Sètifika' },
];

export default function MediaCollections({ lang = 'ht', showToast, onBack }) {
  const isHt = lang === 'ht';
  const [collections, setCollections] = useState(
    PREDEFINED_COLLECTIONS.map((c) => ({ ...c, items: [], expanded: false })),
  );
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = `custom_${Date.now()}`;
    setCollections((prev) => [
      ...prev,
      {
        id,
        icon: 'fa-folder',
        en: newName.trim(),
        ht: newName.trim(),
        items: [],
        expanded: false,
      },
    ]);
    setNewName('');
    setShowCreate(false);
    showToast?.(isHt ? 'Koleksyon kreye!' : 'Collection created!', 'check');
  };

  const toggleExpand = (id) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)),
    );
  };

  return (
    <div className="media-collections">
      {/* Header */}
      <div className="hub-header">
        <button type="button" className="btn-secondary" onClick={onBack}>
          <i className="fas fa-arrow-left" /> {isHt ? 'Retounen' : 'Back'}
        </button>
        <h2 className="studio-section-title" style={{ margin: 0 }}>
          <i className="fas fa-folder" /> {isHt ? 'Koleksyon Medya' : 'Media Collections'}
        </h2>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          <i className="fas fa-plus" /> {isHt ? 'Nouvo Koleksyon' : 'New Collection'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="collections-create-form">
          <input
            type="text"
            className="field-input"
            placeholder={isHt ? 'Non koleksyon...' : 'Collection name...'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
            {isHt ? 'Kreye' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
            {isHt ? 'Anile' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Collections Grid */}
      <div className="collections-grid">
        {collections.map((col) => (
          <div key={col.id} className="collection-card">
            <button
              type="button"
              className="collection-card-header"
              onClick={() => toggleExpand(col.id)}
            >
              <div className="collection-card-icon">
                <i className={`fas ${col.icon}`} />
              </div>
              <div className="collection-card-info">
                <span className="collection-card-name">
                  {isHt ? col.ht : col.en}
                </span>
                <span className="collection-card-count">
                  {col.items.length} {isHt ? 'atik' : 'items'}
                </span>
              </div>
              <i className={`fas fa-chevron-${col.expanded ? 'up' : 'down'} collection-card-arrow`} />
            </button>

            {col.expanded && (
              <div className="collection-card-body">
                {col.items.length === 0 ? (
                  <div className="collection-empty">
                    <i className="fas fa-inbox" />
                    <p>{isHt ? 'Koleksyon sa a vid. Ajoute medya ladan l.' : 'This collection is empty. Add media to it.'}</p>
                  </div>
                ) : (
                  <div className="collection-items">
                    {col.items.map((item) => (
                      <MediaCard key={item.id} media={item} size="small" showActions={false} lang={lang} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
