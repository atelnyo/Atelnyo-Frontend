/**
 * src/components/asset-library/AssetLibrary.jsx
 *
 * Centralized asset management system for Course Studio.
 * Categories: Images, Videos, Audio, Icons, Illustrations, Documents, Thumbnails
 * Features: Upload, Search, Filter, Preview, Rename, Move, Organize into folders, Reuse, Delete
 * Display: File size, File type, Upload date, Usage references
 * Prevents accidental deletion of assets currently used by published content
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { translations } from '../../data/translations';
import styles from './asset-library.module.css';

/* ─── Asset categories ─────────────────────────────────────────── */
const AssetCategories = {
  IMAGES: 'images',
  VIDEOS: 'videos',
  AUDIO: 'audio',
  ICONS: 'icons',
  ILLUSTRATIONS: 'illustrations',
  DOCUMENTS: 'documents',
  THUMBNAILS: 'thumbnails',
};

/* ─── Initial asset state ──────────────────────────────────────── */
function initialAssetState() {
  return {
    assets: [], // { id, name, type, category, url, size, uploadDate, folder, usageCount, tags }
    currentCategory: AssetCategories.IMAGES,
    searchQuery: '',
    selectedAsset: null,
    folders: [{ id: 'root', name: 'My Assets', parentId: null, subFolders: [] }],
    uploadProgress: 0,
  };
}

/* ─── AssetLibrary component ──────────────────────────────────── */
export default function AssetLibrary({ onAssetSelect, onAssetDelete }) {
  const [state, setState] = useState(initialAssetState);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameId, setRenameId] = useState(null);

  const { state: undoState, undo, redo, canUndo, canRedo } = useUndoRedo(state, {
    maxDepth: 50,
  });

  useEffect(() => {
    // Persist asset state
  }, [undoState]);

  /* ─── Filter assets by search ──────────────────────────────── */
  const filteredAssets = state.assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (asset.tags && asset.tags.some((t) => t.toLowerCase().includes(state.searchQuery.toLowerCase())));
    return (
      asset.category === state.currentCategory && matchesSearch
    );
  });

  /* ─── Category toggle ──────────────────────────────────────── */
  const setCurrentCategory = useCallback((category) => {
    setState((prev) => ({ ...prev, currentCategory: category }));
  }, []);

  /* ─── Folder management ────────────────────────────────────── */
  const createFolder = useCallback((name, parentId) => {
    setState((prev) => {
      const newFolder = {
        id: `folder-${Date.now()}-Math.random().toString(36).substr(2)`,
        name,
        parentId,
        subFolders: [],
      };
      // Add to appropriate folder structure
      const updatedFolders = [...prev.folders];
      // Simple: add to root if no parent specified
      if (!parentId) {
        updatedFolders[0].subFolders.push(newFolder);
      }
      return { ...prev, folders: updatedFolders };
    });
  }, []);

  /* ─── Asset actions ──────────────────────────────────────────── */
  const handleUpload = useCallback((file) => {
    const asset = {
      id: `asset-${Date.now()}-Math.random().toString(36).substr(2)`,
      name: file.name,
      type: file.type,
      category: determineCategory(file.type),
      url: URL.createObjectURL(file),
      size: file.size,
      uploadDate: new Date().toISOString(),
      folder: 'root',
      usageCount: 0,
      tags: [],
    };

    setState((prev) => ({
      ...prev,
      assets: [...prev.assets, asset],
    }));
    onAssetSelect?.(asset);
  }, []);

  const determineCategory = (type) => {
    const mime = type.split('/')[0];
    if (mime === 'image') return AssetCategories.IMAGES;
    if (mime === 'video') return AssetCategories.VIDEOS;
    if (mime === 'audio') return AssetCategories.AUDIO;
    return AssetCategories.DOCUMENTS;
  };

  const handleDelete = useCallback((assetId) => {
    // Check if asset is in use
    const asset = state.assets.find((a) => a.id === assetId);
    if (asset && asset.usageCount > 0) {
      // Show warning - asset is in use
      return;
    }
    setState((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
    onAssetDelete?.(assetId);
  }, [state]);

  const handleRename = useCallback((assetId, newName) => {
    setState((prev) => {
      const updatedAssets = prev.assets.map((a) =>
        a.id === assetId ? { ...a, name: newName } : a
      );
      return { ...prev, assets: updatedAssets };
    });
    setShowRenameModal(false);
  }, []);

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="asset-library" role="region" aria-label="Asset library">
      <div className="asset-toolbar">
        <button onClick={() => setShowUploadModal(true)} aria-label={t('Upload asset', 'Telecharger akt')}>
          <i className="fas fa-upload" aria-hidden="true" /> {t('Upload', 'Telecharger')}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={state.searchQuery}
            onChange={(e) => setState((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder={t('Search assets...', 'Rechercher des akt...')}
            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}
            aria-label="Search assets"
          />
          <button
            onClick={() => setState((prev) => ({ ...prev, searchQuery: '' }))}
            style={{ padding: '4px 8px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 4, fontSize: '0.7rem' }}
            aria-label="Clear search"
          >
            ✕
          </button>
        </div>
        <select
          onChange={(e) => setCurrentCategory(e.target.value)}
          style={{ marginLeft: 'auto', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}
          aria-label="Filter by category"
        >
          {Object.values(AssetCategories).map((cat) => (
            <option key={cat} value={cat}>
              {t(cat, cat)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setState((prev) => ({ ...prev, selectedAsset: prev.assets[0] }))}
          disabled={state.assets.length === 0}
          style={{ marginLeft: 'auto', padding: '4px 8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}
          aria-label="Select first asset"
        >
          Select
        </button>
      </div>

      <div className="asset-grid">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className={`asset-item ${state.selectedAsset && state.selectedAsset.id === asset.id ? 'selected' : ''}`}
            style={{
              border: state.selectedAsset && state.selectedAsset.id === asset.id ? '2px solid var(--color-primary)' : '1px solid #dee2e6',
              borderRadius: 6,
              padding: 8,
              background: '#fff',
              cursor: 'pointer',
              transition: 'border 0.15s',
            }}
            onClick={() => setState((prev) => ({ ...prev, selectedAsset: asset }))}
            role="button"
            aria-label={t('Asset: {asset.name}', `Akt: {asset.name}`)}
          >
            <div className="asset-preview" style={{ height: 80, background: '#f0f0f0', borderRadius: 4, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
              {asset.type.startsWith('image') && (
                <img
                  src={asset.url}
                  alt={asset.name}
                  style={{ maxWidth: '60px', maxHeight: '40px', objectFit: 'cover' }}
                />
              )}
              {asset.type.startsWith('video') && (
                <div style={{ width: '40px', height: '30px', background: '#ddd', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <i className="fas fa-video" aria-hidden="true" /> Video
                </div>
              )}
              {asset.type.startsWith('audio') && (
                <div style={{ width: '40px', height: '30px', background: '#ddd', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <i className="fas fa-audio-description" aria-hidden="true" /> Audio
                </div>
              )}
              {asset.type === 'icon' && (
                <i className={`fas fa-${asset.name}`} style={{ fontSize: '20px' }} aria-hidden="true" />
              )}
              {asset.type === 'document' && (
                <div style={{ width: '30px', height: '20px', background: '#ddd', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <i className="fas fa-file" aria-hidden="true" />
                </div>
              )}
              <p style={{ fontSize: '0.65rem', margin: '2px 0 0', color: '#333', whiteSpace: 'nowrap' }}>{asset.name}</p>
            </div>
            <div className="asset-meta" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {asset.size && `${formatBytes(asset.size)} • ${new Date(asset.uploadDate).toLocaleDateString()}`}
            </div>
          </div>
        ))}
      </div>

      {/* Upload modal ─────────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: 500, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('Upload Asset', 'Telecharger Akt')}</h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Drag & drop or browse files to upload
            </p>
            <p style={{ margin: '4px 0 12px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Supported: images, videos, audio, documents
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files);
                files.forEach(handleUpload);
              }}
              style={{ display: 'none' }}
            />
            <button type="button" onClick={() => setShowUploadModal(false)} style={{ marginTop: '8px', padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helper: format bytes ────────────────────────────────────── */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}